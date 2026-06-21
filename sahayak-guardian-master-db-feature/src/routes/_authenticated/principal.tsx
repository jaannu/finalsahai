import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  generateMorningBriefing,
  getHighRiskStudents,
  getLatestBriefing,
} from "@/lib/sahayak.functions";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Volume2,
  Sparkles,
  Phone,
  MessageSquare,
  UserPlus,
  Loader2,
  BellRing,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { bcp47For } from "@/lib/i18n";
import { TricolorBar, MandalaRing, AshokaChakra } from "@/components/IndianMotifs";

export const Route = createFileRoute("/_authenticated/principal")({
  head: () => ({ meta: [{ title: "Principal · Sahayak" }] }),
  component: PrincipalPage,
});

function speak(text: string, lang: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    toast.error("Text-to-speech not available in this browser");
    return;
  }
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  const v = window.speechSynthesis
    .getVoices()
    .find((vo) => vo.lang?.toLowerCase().startsWith(lang.toLowerCase().slice(0, 2)));
  if (v) u.voice = v;
  u.rate = 0.95;
  u.pitch = 1;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

function PrincipalPage() {
  const qc = useQueryClient();
  const { t, i18n } = useTranslation();
  const riskFn = useServerFn(getHighRiskStudents);
  const briefingFn = useServerFn(getLatestBriefing);
  const genFn = useServerFn(generateMorningBriefing);

  const { data: risk } = useQuery({ queryKey: ["risk"], queryFn: () => riskFn() });
  const { data: briefing } = useQuery({ queryKey: ["briefing"], queryFn: () => briefingFn() });

  const [useReal, setUseReal] = useState(true);
  const [busy, setBusy] = useState(false);

  async function generate() {
    setBusy(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const b = await genFn({
        data: { date: today, useReal, language: i18n.resolvedLanguage ?? "en" },
      });
      toast.success(b.used_real_ai ? "AI briefing generated" : "Rule-based briefing generated");
      qc.invalidateQueries({ queryKey: ["briefing"] });
      qc.invalidateQueries({ queryKey: ["risk"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Could not generate briefing");
    } finally {
      setBusy(false);
    }
  }

  const items = risk?.items ?? [];
  const highCount = items.filter((i: any) => i.level === "high").length;
  const medCount = items.filter((i: any) => i.level === "medium").length;

  return (
    <div className="min-h-screen">
      <TricolorBar />
      <div className="mx-auto max-w-5xl px-4 py-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <MandalaRing size={52} />
            <div>
              <h1 className="font-display text-3xl">{t("principal_title")}</h1>
              <p className="text-sm text-muted-foreground">{t("tagline")}</p>
            </div>
          </div>
          <Link to="/teacher">
            <Button variant="outline" size="sm">
              {t("teacher")}
            </Button>
          </Link>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <div className="md:col-span-2 rounded-2xl border bg-card p-5 shadow-[var(--shadow-warm)] relative overflow-hidden">
            <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full opacity-20 [background:var(--gradient-hero)]" />
            <div className="relative">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <BellRing className="h-3.5 w-3.5" /> Today ·{" "}
                {new Date().toLocaleDateString("en-IN", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </div>
              <h2 className="font-display text-2xl mt-1">
                {highCount} high-risk · {medCount} medium-risk
              </h2>
              <p className="mt-3 text-[15px] leading-relaxed min-h-[80px]">
                {briefing?.summary_text ?? (
                  <span className="text-muted-foreground italic">
                    No briefing yet. Generate one below.
                  </span>
                )}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 rounded-md border bg-secondary/40 px-3 py-1.5 text-xs">
                  <Sparkles className="h-3.5 w-3.5 text-[var(--terracotta)]" />
                  {t("use_real_ai")}
                  <Switch checked={useReal} onCheckedChange={setUseReal} />
                </div>
                <Button variant="hero" onClick={generate} disabled={busy}>
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {t("generate_briefing")}
                </Button>
                <Button
                  variant="outline"
                  disabled={!briefing?.summary_text}
                  onClick={() =>
                    speak(briefing!.summary_text, bcp47For(i18n.resolvedLanguage ?? "en"))
                  }
                >
                  <Volume2 className="h-4 w-4" /> {t("play")}
                </Button>
                {briefing?.used_real_ai ? (
                  <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full risk-chip-low">
                    AI
                  </span>
                ) : (
                  briefing && (
                    <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full risk-chip-medium">
                      Rules
                    </span>
                  )
                )}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-5">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">
              Risk distribution
            </div>
            <div className="mt-3 space-y-3">
              <RiskBar
                label="High"
                count={highCount}
                total={items.length}
                cls="bg-[var(--risk-high)]"
              />
              <RiskBar
                label="Medium"
                count={medCount}
                total={items.length}
                cls="bg-[var(--risk-medium)]"
              />
              <RiskBar
                label="Tracked"
                count={items.length}
                total={Math.max(items.length, 1)}
                cls="bg-[var(--indigo)]"
              />
            </div>
            <div className="mt-4 text-xs text-muted-foreground flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5" /> Audited & role-scoped
            </div>
          </div>
        </div>

        <div className="rounded-2xl border bg-card">
          <div className="p-4 border-b flex items-center justify-between">
            <div>
              <div className="font-display text-xl">{t("students_attention")}</div>
              <div className="text-xs text-muted-foreground">
                Ordered by risk score · explainable, rule-based
              </div>
            </div>
            <div className="text-xs text-muted-foreground">{items.length} total</div>
          </div>
          <div className="divide-y">
            {items.length === 0 && (
              <div className="p-6 text-center text-sm text-muted-foreground">
                No risk data yet. Ask the teacher to capture today's attendance.
              </div>
            )}
            {items.map((it: any) => (
              <div
                key={it.student_id}
                className="p-4 flex flex-wrap items-start justify-between gap-3"
              >
                <div className="min-w-[200px]">
                  <div className="flex items-center gap-2">
                    <div className="font-medium">{it.students?.full_name}</div>
                    <span
                      className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full risk-chip-${it.level}`}
                    >
                      {it.level} · {it.score}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Grade {it.students?.grade}
                    {it.students?.section ? `-${it.students.section}` : ""}
                  </div>
                  <ul className="mt-2 text-xs space-y-0.5">
                    {(it.reasons ?? []).map((r: string, i: number) => (
                      <li key={i}>• {r}</li>
                    ))}
                  </ul>
                </div>
                <div className="flex-1 min-w-[200px]">
                  <div className="text-xs uppercase tracking-widest text-muted-foreground">
                    Recommended
                  </div>
                  <ul className="mt-1 text-sm">
                    {(it.recommended_actions ?? []).map((a: string, i: number) => (
                      <li key={i}>→ {a}</li>
                    ))}
                  </ul>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      toast.success(
                        `SMS sent to ${it.students?.guardian_phone || "parent"} for ${it.students?.full_name}`,
                      )
                    }
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    SMS parent
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      toast.success(
                        `Call initiated to ${it.students?.guardian_phone || "parent"} for ${it.students?.full_name}`,
                      )
                    }
                  >
                    <Phone className="h-3.5 w-3.5" />
                    Call
                  </Button>
                  <Button
                    size="sm"
                    variant="hero"
                    onClick={() =>
                      toast.success(
                        `Intervention approved: counsellor assigned to ${it.students?.full_name}`,
                      )
                    }
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    Approve intervention
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="text-xs text-muted-foreground text-center pt-4 flex flex-col items-center gap-2">
          <AshokaChakra size={24} color="var(--indigo)" />
          <p>
            Mocked channels (Twilio · WhatsApp · SMS · government APIs) are wired for demo. Real
            adapters in Phase 2.
          </p>
        </div>
      </div>
    </div>
  );
}

function RiskBar({
  label,
  count,
  total,
  cls,
}: {
  label: string;
  count: number;
  total: number;
  cls: string;
}) {
  const pct = total ? Math.round((count / total) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs">
        <span>{label}</span>
        <span className="text-muted-foreground">{count}</span>
      </div>
      <div className="h-2 rounded-full bg-secondary overflow-hidden mt-1">
        <div className={`h-full ${cls}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
