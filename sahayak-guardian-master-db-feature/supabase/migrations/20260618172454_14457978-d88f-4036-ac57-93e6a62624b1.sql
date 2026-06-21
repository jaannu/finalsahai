
-- Enum for roles
CREATE TYPE public.app_role AS ENUM ('teacher','principal','counsellor','education_officer','district_admin');
CREATE TYPE public.attendance_status AS ENUM ('present','absent','late');
CREATE TYPE public.risk_level AS ENUM ('low','medium','high');
CREATE TYPE public.extraction_source AS ENUM ('photo','voice','csv','manual','ivr');
CREATE TYPE public.extraction_status AS ENUM ('pending','verified','rejected');

-- Schools
CREATE TABLE public.schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  district TEXT,
  state TEXT,
  udise_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schools TO authenticated;
GRANT ALL ON public.schools TO service_role;
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read schools" ON public.schools FOR SELECT TO authenticated USING (true);

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  email TEXT,
  school_id UUID REFERENCES public.schools(id),
  language TEXT NOT NULL DEFAULT 'en',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles readable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- User roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  school_id UUID REFERENCES public.schools(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Students
CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  gender TEXT,
  grade TEXT NOT NULL,
  section TEXT,
  guardian_phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.students TO authenticated;
GRANT ALL ON public.students TO service_role;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read students" ON public.students FOR SELECT TO authenticated USING (true);
CREATE POLICY "Teachers/principals manage students" ON public.students FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'teacher') OR public.has_role(auth.uid(),'principal'))
  WITH CHECK (public.has_role(auth.uid(),'teacher') OR public.has_role(auth.uid(),'principal'));

-- Attendance
CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status public.attendance_status NOT NULL,
  source public.extraction_source NOT NULL DEFAULT 'manual',
  marked_by UUID REFERENCES auth.users(id),
  confidence NUMERIC(4,3) DEFAULT 1.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance TO authenticated;
GRANT ALL ON public.attendance TO service_role;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read attendance" ON public.attendance FOR SELECT TO authenticated USING (true);
CREATE POLICY "Teachers write attendance" ON public.attendance FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'teacher') OR public.has_role(auth.uid(),'principal'));
CREATE POLICY "Teachers update attendance" ON public.attendance FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'teacher') OR public.has_role(auth.uid(),'principal'));

-- Extractions (AI OCR audit trail)
CREATE TABLE public.extractions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  source public.extraction_source NOT NULL,
  status public.extraction_status NOT NULL DEFAULT 'pending',
  grade TEXT,
  section TEXT,
  date DATE NOT NULL,
  payload JSONB NOT NULL,
  avg_confidence NUMERIC(4,3),
  flagged_reasons JSONB DEFAULT '[]'::jsonb,
  photo_url TEXT,
  used_real_ai BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.extractions TO authenticated;
GRANT ALL ON public.extractions TO service_role;
ALTER TABLE public.extractions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read extractions" ON public.extractions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Creators manage extractions" ON public.extractions FOR ALL TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(),'principal'))
  WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(),'principal'));

-- Risk scores
CREATE TABLE public.risk_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  score INT NOT NULL,
  level public.risk_level NOT NULL,
  reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommended_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.risk_scores TO authenticated;
GRANT ALL ON public.risk_scores TO service_role;
ALTER TABLE public.risk_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read risk_scores" ON public.risk_scores FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff write risk_scores" ON public.risk_scores FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'teacher') OR public.has_role(auth.uid(),'principal') OR public.has_role(auth.uid(),'counsellor'))
  WITH CHECK (public.has_role(auth.uid(),'teacher') OR public.has_role(auth.uid(),'principal') OR public.has_role(auth.uid(),'counsellor'));

-- Briefings
CREATE TABLE public.briefings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  summary_text TEXT NOT NULL,
  high_risk_count INT NOT NULL DEFAULT 0,
  payload JSONB,
  generated_by UUID REFERENCES auth.users(id),
  used_real_ai BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.briefings TO authenticated;
GRANT ALL ON public.briefings TO service_role;
ALTER TABLE public.briefings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read briefings" ON public.briefings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff write briefings" ON public.briefings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'principal') OR public.has_role(auth.uid(),'teacher'))
  WITH CHECK (public.has_role(auth.uid(),'principal') OR public.has_role(auth.uid(),'teacher'));

-- Audit logs
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity TEXT,
  entity_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read audit" ON public.audit_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert audit" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (actor_id = auth.uid());

-- Auto-create profile + default teacher role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  default_school UUID;
  chosen_role public.app_role;
BEGIN
  SELECT id INTO default_school FROM public.schools ORDER BY created_at LIMIT 1;
  IF default_school IS NULL THEN
    INSERT INTO public.schools (name, district, state, udise_code)
    VALUES ('Govt Primary School, Anjanapura','Bengaluru South','Karnataka','29200100101')
    RETURNING id INTO default_school;
  END IF;

  INSERT INTO public.profiles (id, display_name, email, school_id, language)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)),
    NEW.email,
    default_school,
    COALESCE(NEW.raw_user_meta_data->>'language','en')
  );

  chosen_role := COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'teacher');
  INSERT INTO public.user_roles (user_id, role, school_id) VALUES (NEW.id, chosen_role, default_school);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
