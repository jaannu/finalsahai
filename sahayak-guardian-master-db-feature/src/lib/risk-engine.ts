// Pure rule-based risk engine. No LLM. Runs server-side.

export type RiskInput = {
  attendance_rate: number;       // 0..1
  consecutive_absences: number;
  academic_drop_pct?: number;    // e.g. 15 = 15% drop
  previous_intervention?: boolean;
  vulnerable_group?: boolean;
};

export type RiskResult = {
  score: number;
  level: "low" | "medium" | "high";
  reasons: string[];
  recommended_actions: string[];
};

export function computeRisk(i: RiskInput): RiskResult {
  let score = 0;
  const reasons: string[] = [];

  if (i.attendance_rate < 0.75) {
    score += 30;
    reasons.push(`Attendance is ${Math.round(i.attendance_rate * 100)}%`);
  }
  if (i.consecutive_absences >= 5) {
    score += 25;
    reasons.push(`Absent for ${i.consecutive_absences} consecutive days`);
  }
  if ((i.academic_drop_pct ?? 0) >= 10) {
    score += 20;
    reasons.push(`Academic score dropped by ${i.academic_drop_pct}%`);
  }
  if (i.previous_intervention) {
    score += 15;
    reasons.push("Previous intervention on file");
  }
  if (i.vulnerable_group) {
    score += 10;
    reasons.push("Belongs to vulnerable group");
  }

  score = Math.min(100, score);
  const level: RiskResult["level"] = score >= 71 ? "high" : score >= 41 ? "medium" : "low";

  const recommended_actions: string[] = [];
  if (level === "high") {
    recommended_actions.push("Call parent today", "Assign counsellor", "Monitor weekly");
  } else if (level === "medium") {
    recommended_actions.push("Send SMS reminder to parent", "Flag for counsellor review");
  } else {
    recommended_actions.push("Continue routine monitoring");
  }

  return { score, level, reasons, recommended_actions };
}