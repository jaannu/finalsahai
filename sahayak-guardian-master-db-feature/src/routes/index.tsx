import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import {
  AshokaChakra,
} from "@/components/IndianMotifs";
import {
  Camera,
  ShieldCheck,
  Brain,
  Bell,
  CheckCircle2,
  Users,
  Languages,
  WifiOff,
  Lock,
  ArrowRight,
  TrendingDown,
  AlertTriangle,
  Activity,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sahayak — School Risk Intelligence" },
      {
        name: "description",
        content:
          "Predict student dropout risk. Validate attendance. Decide with evidence. Intervene early.",
      },
      { property: "og:title", content: "Sahayak — School Risk Intelligence" },
      {
        property: "og:description",
        content:
          "From attendance to action. Predict, validate, decide, and intervene — for every child.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const { t } = useTranslation();

  const briefingStudents = [
    { name: "Rahul K.", grade: t("grade_5"), reasonKey: "demo_reason_absences_7", level: "high", Icon: TrendingDown },
    { name: "Priya M.", grade: t("grade_5"), reasonKey: "demo_reason_attendance_68", level: "high", Icon: AlertTriangle },
    { name: "Asha S.", grade: t("grade_6"), reasonKey: "demo_reason_absences_3", level: "medium", Icon: AlertTriangle },
    { name: "Karan P.", grade: t("grade_4"), reasonKey: "demo_reason_score_decline", level: "medium", Icon: TrendingDown },
  ] as const;

  const steps = [
    { Icon: Camera, step: "01", titleKey: "step1_title", bodyKey: "step1_body", accent: "var(--saffron)" },
    { Icon: Brain, step: "02", titleKey: "step2_title", bodyKey: "step2_body", accent: "var(--marigold)" },
    { Icon: CheckCircle2, step: "03", titleKey: "step3_title", bodyKey: "step3_body", accent: "var(--indigo)" },
    { Icon: Bell, step: "04", titleKey: "step4_title", bodyKey: "step4_body", accent: "var(--terracotta)" },
  ] as const;

  const principles = [
    { Icon: ShieldCheck, titleKey: "principle1_title", bodyKey: "principle1_body" },
    { Icon: Users, titleKey: "principle2_title", bodyKey: "principle2_body" },
    { Icon: WifiOff, titleKey: "principle3_title", bodyKey: "principle3_body" },
  ] as const;

  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <header className="border-b bg-background/95 backdrop-blur-md sticky top-0 z-30">
        <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-md grid place-items-center [background:var(--gradient-hero)]">
              <AshokaChakra size={22} className="text-white opacity-90" />
            </div>
            <div className="leading-tight">
              <div className="font-display text-base font-semibold tracking-tight">Sahayak</div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground -mt-0.5">
                {t("brand_sub")}
              </div>
            </div>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#how" className="hover:text-foreground transition-colors">{t("how_it_works")}</a>
            <a href="#principles" className="hover:text-foreground transition-colors">{t("principles_nav")}</a>
          </nav>
          <div className="flex items-center gap-2">
            <LanguageSwitcher compact />
            <Link to="/auth">
              <Button variant="ghost" size="sm">{t("sign_in")}</Button>
            </Link>
            <Link to="/auth">
              <Button variant="hero" size="sm">{t("get_started")}</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b">
        {/* Subtle background grid */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(var(--foreground) 1px, transparent 1px), linear-gradient(90deg, var(--foreground) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        <div className="mx-auto max-w-6xl px-6 py-20 md:py-28 grid md:grid-cols-2 gap-16 items-center relative">
          <div>
            {/* Eyebrow */}
            <div className="inline-flex items-center gap-2 border border-[var(--saffron)/40] bg-[var(--saffron)/8] text-[var(--terracotta)] text-xs font-medium tracking-wide px-3 py-1 rounded-full mb-6">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--saffron)]" />
              {t("eyebrow_built_for")}
            </div>

            <h1 className="font-display text-[2.75rem] md:text-[3.5rem] leading-[1.08] tracking-tight">
              {t("hero_title_1")}
              <br />
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: "var(--gradient-hero)" }}
              >
                {t("hero_title_2")}
              </span>
            </h1>

            <p className="mt-5 text-base md:text-lg text-muted-foreground leading-relaxed max-w-lg">
              {t("hero_sub")}
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/auth">
                <Button variant="hero" size="xl" className="gap-2">
                  {t("open_dashboard")} <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <a href="#how">
                <Button variant="outline" size="xl">
                  {t("how_it_works")}
                </Button>
              </a>
            </div>

            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <WifiOff className="h-3.5 w-3.5" /> {t("offline_first")}
              </span>
              <span className="flex items-center gap-1.5">
                <Languages className="h-3.5 w-3.5" /> {t("multilingual")}
              </span>
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" /> {t("role_audited")}
              </span>
              <span className="flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5" /> {t("dpda_compliant")}
              </span>
            </div>
          </div>

          {/* Dashboard preview card */}
          <div className="relative">
            <div
              className="absolute -inset-10 opacity-15 blur-3xl rounded-full"
              style={{ background: "var(--gradient-hero)" }}
            />
            <div className="relative rounded-2xl border bg-card shadow-[var(--shadow-warm)] overflow-hidden">
              {/* Card header */}
              <div className="px-5 py-3 border-b flex items-center justify-between bg-card">
                <div className="flex items-center gap-2">
                  <Activity className="h-3.5 w-3.5 text-[var(--terracotta)]" />
                  <span className="text-xs font-medium text-muted-foreground tracking-wide uppercase">
                    {t("preview_card_label")}
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground">{t("today")}</span>
              </div>

              <div className="p-5">
                <div className="font-display text-xl">{t("preview_headline", { count: 4 })}</div>
                <p className="text-sm text-muted-foreground mt-1 mb-4">
                  {t("preview_subline", { count: 2 })}
                </p>

                <div className="space-y-2">
                  {briefingStudents.map(({ name, grade, reasonKey, level, Icon }) => (
                    <div
                      key={name}
                      className={`flex items-center justify-between rounded-lg border bg-background/60 px-3 py-2.5 ${
                        level === "high"
                          ? "border-[var(--terracotta)/30]"
                          : "border-[var(--marigold)/40]"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`h-7 w-7 rounded-md grid place-items-center flex-shrink-0 ${
                            level === "high"
                              ? "bg-[var(--risk-high)/12] text-[var(--risk-high)]"
                              : "bg-[var(--marigold)/15] text-[var(--terracotta)]"
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div>
                          <div className="text-sm font-medium leading-none">{name}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {grade} · {t(reasonKey)}
                          </div>
                        </div>
                      </div>
                      <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full risk-chip-${level}`}>
                        {t(`level_${level}`)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-4 pt-3 border-t flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {t("preview_recommended")}
                  </p>
                  <Lock className="h-3 w-3 text-muted-foreground flex-shrink-0 ml-3" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────────────── */}
      <section id="how" className="mx-auto max-w-6xl px-6 py-20">
        <div className="mb-10">
          <p className="text-xs uppercase tracking-widest text-[var(--terracotta)] font-medium mb-2">
            {t("the_process")}
          </p>
          <h2 className="font-display text-3xl md:text-4xl tracking-tight">
            {t("how_section_title")}
          </h2>
          <p className="text-muted-foreground mt-3 max-w-2xl text-base">
            {t("how_section_sub")}
          </p>
        </div>

        <div className="grid md:grid-cols-4 gap-4">
          {steps.map(({ Icon, step, titleKey, bodyKey, accent }) => (
            <div
              key={step}
              className="relative rounded-xl border bg-card p-5 shadow-[var(--shadow-soft)] hover:shadow-[var(--shadow-warm)] transition-shadow"
            >
              <div
                className="text-[10px] font-bold tracking-widest mb-4"
                style={{ color: accent }}
              >
                {step}
              </div>
              <div
                className="h-9 w-9 rounded-lg grid place-items-center mb-3"
                style={{ background: `color-mix(in oklch, ${accent} 18%, transparent)` }}
              >
                <Icon className="h-4.5 w-4.5" style={{ color: accent }} />
              </div>
              <div className="font-display text-lg font-semibold">{t(titleKey)}</div>
              <div className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{t(bodyKey)}</div>
              <div
                className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-xl"
                style={{ background: accent }}
              />
            </div>
          ))}
        </div>
      </section>

      {/* ── Principles ──────────────────────────────────────────────────── */}
      <section id="principles" className="border-t border-b bg-card/40">
        <div className="mx-auto max-w-6xl px-6 py-16 grid md:grid-cols-3 gap-8">
          {principles.map(({ Icon, titleKey, bodyKey }) => (
            <div key={titleKey} className="flex gap-4">
              <div className="flex-shrink-0 h-9 w-9 rounded-lg border grid place-items-center text-[var(--terracotta)]">
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <div className="font-display text-base font-semibold">{t(titleKey)}</div>
                <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{t(bodyKey)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────────── */}
      <section className="vedic-hero">
        <div className="mx-auto max-w-6xl px-6 py-20 text-center text-white relative">
          <p className="text-xs uppercase tracking-widest opacity-70 mb-4 font-medium">
            {t("cta_eyebrow")}
          </p>
          <h2 className="font-display text-3xl md:text-4xl tracking-tight">
            {t("cta_title")}
          </h2>
          <p className="opacity-80 mt-3 max-w-xl mx-auto text-base">
            {t("cta_sub")}
          </p>
          <Link to="/auth" className="inline-block mt-8">
            <Button variant="marigold" size="xl" className="gap-2">
              {t("cta_button")} <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex flex-wrap justify-center gap-6 mt-8 text-xs opacity-60">
            <span>ISO 27001 Ready</span>
            <span>CERT-In</span>
            <span>{t("make_in_india")}</span>
            <span>DPDP-Act 2023</span>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="border-t py-8">
        <div className="mx-auto max-w-6xl px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <AshokaChakra size={14} />
            <span>{t("footer_copyright")}</span>
          </div>
          <div className="flex gap-6">
            <a href="#" className="hover:text-foreground transition-colors">{t("privacy_policy")}</a>
            <a href="#" className="hover:text-foreground transition-colors">{t("dpdp_compliance")}</a>
            <a href="#" className="hover:text-foreground transition-colors">{t("contact")}</a>
          </div>
          <div>CERT-In · ISO 27001 Ready · DPDP-Act 2023</div>
        </div>
      </footer>

    </div>
  );
}