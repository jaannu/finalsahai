import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useTranslation } from "react-i18next";
import { AshokaChakra, MandalaRing, TricolorBar } from "@/components/IndianMotifs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({ meta: [{ title: "Sign in · Sahayak" }] }),
  beforeLoad: async () => {
    if (typeof window !== "undefined") {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        // Redirect based on actual role, not always to /teacher
        const { data: r } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", data.session.user.id);
        const userRoles = (r ?? []).map((x) => x.role);
        const isPrincipalOrStaff =
          userRoles.includes("principal") ||
          userRoles.includes("counsellor") ||
          userRoles.includes("education_officer") ||
          userRoles.includes("district_admin");
        throw redirect({ to: isPrincipalOrStaff ? "/principal" : "/teacher" });
      }
    }
  },
  component: AuthPage,
});

const ROLES = [
  { v: "teacher", l: "Teacher", d: "दैनिक उपस्थिति दर्ज करें" },
  { v: "principal", l: "Principal", d: "प्रातःकालीन ब्रीफ़िंग" },
  { v: "counsellor", l: "Counsellor", d: "जोखिम में छात्रों का मार्गदर्शन" },
  { v: "education_officer", l: "Education Officer", d: "क्षेत्रीय रुझान देखें" },
  { v: "district_admin", l: "District Admin", d: "जिला-स्तरीय अवलोकन" },
];

/** Resolve where a signed-in user should land based on their roles. */
async function resolveDestination(userId: string): Promise<"/teacher" | "/principal"> {
  try {
    const { data: r } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const userRoles = (r ?? []).map((x) => x.role);
    const isPrincipalOrStaff =
      userRoles.includes("principal") ||
      userRoles.includes("counsellor") ||
      userRoles.includes("education_officer") ||
      userRoles.includes("district_admin");
    return isPrincipalOrStaff ? "/principal" : "/teacher";
  } catch {
    return "/teacher";
  }
}

function AuthPage() {
  const nav = useNavigate();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showSigninPassword, setShowSigninPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("teacher");

  // Listen for auth state changes (handles both sign-in and email-confirmed sign-up)
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, session) => {
      if (session) {
        const dest = await resolveDestination(session.user.id);
        nav({ to: dest });
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [nav]);

  async function signIn() {
    if (!email || !password) {
      toast.error("Please enter your email and password.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      // Provide friendlier messages for the most common cases
      if (error.message.includes("Invalid login credentials")) {
        toast.error("Incorrect email or password. Please try again.");
      } else if (error.message.includes("Email not confirmed")) {
        toast.error("Please confirm your email address before signing in. Check your inbox.");
      } else {
        toast.error(error.message);
      }
      return;
    }
    toast.success("Welcome back!");
    // Navigation handled by onAuthStateChange above
  }

  async function signUp() {
    if (!email || !password) {
      toast.error("Please enter your email and password.");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    const lang = (typeof window !== "undefined" && localStorage.getItem("i18nextLng")) || "en";
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: name.trim() || email.split("@")[0], role, language: lang },
      },
    });
    setLoading(false);

    if (error) {
      if (error.message.includes("already registered") || error.message.includes("User already registered")) {
        toast.error("An account with this email already exists. Please sign in instead.", {
          action: { label: "Sign in", onClick: () => setTab("signin") },
        });
      } else {
        toast.error(error.message);
      }
      return;
    }

    // If email confirmation is required, the session will be null
    if (data.session) {
      // Auto-confirmed (e.g. local dev or confirmation disabled) — onAuthStateChange handles redirect
      toast.success("Account created! Signing you in…");
    } else {
      // Confirmation email sent
      toast.success("Account created! Please check your email to confirm your address, then sign in.", {
        duration: 8000,
      });
      setTab("signin");
    }
  }

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      <div className="hidden md:flex vedic-hero text-white flex-col relative overflow-hidden">
        <TricolorBar />
        <div className="flex flex-col justify-between flex-1 p-12">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-md bg-white/15 grid place-items-center">
              <AshokaChakra size={36} color="white" />
            </div>
            <div className="font-display text-2xl">Sahayak</div>
          </Link>
          <div className="max-w-md">
            <div className="text-xs uppercase tracking-widest opacity-80">सहायक</div>
            <h2 className="font-display text-4xl mt-2 leading-tight">{t("auth_welcome")}</h2>
            <p className="opacity-90 mt-3">{t("auth_welcome_sub")}</p>
            <div className="text-xs space-y-1.5 mt-5 opacity-80">
              <div className="flex items-start gap-2">
                <span className="text-[var(--saffron)] shrink-0 mt-0.5">-</span>
                <span>DPDP-Act 2023 compliant</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[var(--saffron)] shrink-0 mt-0.5">-</span>
                <span>Data hosted in India (Mumbai region)</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[var(--saffron)] shrink-0 mt-0.5">-</span>
                <span>Role-based access · Full audit trail</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[var(--saffron)] shrink-0 mt-0.5">-</span>
                <span>Offline-first · Works on 2G</span>
              </div>
            </div>
          </div>
          <div className="text-xs opacity-70">© Sahayak · Made in India · ISO 27001 Ready</div>
          <MandalaRing size={200} className="opacity-10 absolute bottom-0 right-0" />
        </div>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="flex items-center justify-between mb-6">
            <div className="md:hidden flex items-center gap-2">
              <div className="h-8 w-8 rounded-md [background:var(--gradient-hero)] grid place-items-center text-white">
                <AshokaChakra size={24} color="white" />
              </div>
              <div className="font-display text-xl">Sahayak</div>
            </div>
            <div className="ml-auto">
              <LanguageSwitcher compact />
            </div>
          </div>
          <h1 className="font-display text-3xl">{t("sign_in")}</h1>

          <Tabs value={tab} onValueChange={(v) => setTab(v as "signin" | "signup")} className="mt-6">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger
                value="signin"
                className="data-[state=active]:bg-[var(--terracotta)] data-[state=active]:text-white"
              >
                {t("sign_in")}
              </TabsTrigger>
              <TabsTrigger
                value="signup"
                className="data-[state=active]:bg-[var(--terracotta)] data-[state=active]:text-white"
              >
                {t("create_account")}
              </TabsTrigger>
            </TabsList>

            {/* ── Sign In ── */}
            <TabsContent value="signin" className="space-y-3 mt-4">
              <div>
                <Label htmlFor="signin-email">Email</Label>
                <Input
                  id="signin-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && signIn()}
                />
              </div>
              <div>
                <Label htmlFor="signin-password">Password</Label>
                <div className="relative">
                  <Input
                    id="signin-password"
                    type={showSigninPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && signIn()}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSigninPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showSigninPassword ? "Hide password" : "Show password"}
                    tabIndex={-1}
                  >
                    {showSigninPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button variant="hero" className="w-full" disabled={loading} onClick={signIn}>
                {loading ? "Signing in…" : "Sign in"}
              </Button>
            </TabsContent>

            {/* ── Sign Up ── */}
            <TabsContent value="signup" className="space-y-3 mt-4">
              <div>
                <Label htmlFor="signup-name">Display name</Label>
                <Input
                  id="signup-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Sundari Ma'am"
                  autoComplete="name"
                />
              </div>
              <div>
                <Label htmlFor="signup-email">Email</Label>
                <Input
                  id="signup-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="signup-password">Password</Label>
                <div className="relative">
                  <Input
                    id="signup-password"
                    type={showSignupPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSignupPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showSignupPassword ? "Hide password" : "Show password"}
                    tabIndex={-1}
                  >
                    {showSignupPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <Label>Role</Label>
                <TooltipProvider>
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r.v} value={r.v}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="w-full inline-block">{r.l}</span>
                            </TooltipTrigger>
                            <TooltipContent side="right">
                              <p>{r.d}</p>
                            </TooltipContent>
                          </Tooltip>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TooltipProvider>
              </div>
              <Button variant="hero" className="w-full" disabled={loading} onClick={signUp}>
                {loading ? "Creating account…" : "Create account"}
              </Button>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}