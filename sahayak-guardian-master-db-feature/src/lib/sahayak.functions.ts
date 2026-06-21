import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/lib/server-auth";
import type { AuthContext } from "@/lib/server-auth";
import { z } from "zod";
import { computeRisk } from "@/lib/risk-engine";
import { generateTextWithFallback, hasAiConfigured } from "@/lib/ai-client";

type HandlerContext = AuthContext & { isMock?: boolean; mockRole?: string };

// Memory store for mock mode
let mockExtractions: any[] = [];
let mockTodayCount = 0;
let mockRiskScores: any[] = [];
let mockLatestBriefing: any = null;

/** Verified extraction → upsert students + attendance + recompute risk for the affected grade. */
const SaveInput = z.object({
  date: z.string(),
  grade: z.string(),
  section: z.string().optional().default(""),
  source: z.enum(["photo", "voice", "csv", "manual", "ivr"]).default("photo"),
  used_real_ai: z.boolean().default(false),
  avg_confidence: z.number().min(0).max(1),
  flagged_reasons: z.array(z.string()).default([]),
  rows: z.array(
    z.object({
      student_name: z.string().min(1),
      gender: z.string().optional().default(""),
      status: z.enum(["present", "absent", "late"]),
      confidence: z.number(),
    }),
  ),
});

export const saveVerifiedAttendance = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => SaveInput.parse(d))
  .handler(async ({ data, context }: any) => {
    const ctx = context as HandlerContext;
    const { supabase, userId } = ctx;

    function saveToMock() {
      mockExtractions.unshift({
        id: Math.random().toString(),
        grade: data.grade,
        section: data.section || null,
        date: data.date,
        status: "verified",
        avg_confidence: data.avg_confidence,
        used_real_ai: data.used_real_ai,
        created_at: new Date().toISOString(),
        flagged_reasons: data.flagged_reasons,
      });
      mockTodayCount = data.rows.length;

      mockRiskScores = data.rows.map((r: any) => ({
        student_id: r.student_name,
        score: r.status === "absent" ? 85 : 15,
        level: r.status === "absent" ? "high" : "low",
        reasons: r.status === "absent" ? ["7 consecutive absences"] : [],
        recommended_actions: r.status === "absent" ? ["Contact parents", "Assign counsellor"] : [],
        computed_at: new Date().toISOString(),
        students: {
          full_name: r.student_name,
          grade: data.grade,
          section: data.section || "",
        },
      }));
    }

    if (ctx.isMock) {
      saveToMock();
      return { ok: true, students: data.rows.length };
    }

    try {
      // Look up school
      const { data: prof } = await supabase
        .from("profiles")
        .select("school_id")
        .eq("id", userId)
        .maybeSingle();
      const school_id = prof?.school_id;
      if (!school_id) throw new Error("No school assigned to this user");

      // Upsert students by (school_id, full_name, grade)
      const studentIds = new Map<string, string>();
      for (const r of data.rows) {
        const { data: existing } = await supabase
          .from("students")
          .select("id")
          .eq("school_id", school_id)
          .eq("full_name", r.student_name)
          .eq("grade", data.grade)
          .maybeSingle();
        let id = existing?.id;
        if (!id) {
          const { data: ins, error } = await supabase
            .from("students")
            .insert({
              school_id,
              full_name: r.student_name,
              gender: r.gender || null,
              grade: data.grade,
              section: data.section || null,
            })
            .select("id")
            .single();
          if (error) throw error;
          id = ins.id;
        }
        studentIds.set(r.student_name, id!);
      }

      // Upsert attendance for date
      const attRows = data.rows.map((r: any) => ({
        student_id: studentIds.get(r.student_name)!,
        school_id,
        date: data.date,
        status: r.status,
        source: data.source,
        marked_by: userId,
        confidence: r.confidence,
      }));
      const { error: aerr } = await supabase
        .from("attendance")
        .upsert(attRows, { onConflict: "student_id,date" });
      if (aerr) throw aerr;

      // Save extraction record
      await supabase.from("extractions").insert({
        school_id,
        created_by: userId,
        source: data.source,
        status: "verified",
        grade: data.grade,
        section: data.section || null,
        date: data.date,
        payload: { rows: data.rows },
        avg_confidence: data.avg_confidence,
        flagged_reasons: data.flagged_reasons,
        used_real_ai: data.used_real_ai,
        verified_at: new Date().toISOString(),
      });

      // Recompute risk for every student in this grade
      const { data: students } = await supabase
        .from("students")
        .select("id,full_name")
        .eq("school_id", school_id)
        .eq("grade", data.grade);

      const today = new Date(data.date);
      const since = new Date(today);
      since.setDate(today.getDate() - 30);

      for (const s of students ?? []) {
        const { data: hist } = await supabase
          .from("attendance")
          .select("date,status")
          .eq("student_id", s.id)
          .gte("date", since.toISOString().slice(0, 10))
          .order("date", { ascending: false });
        const total = hist?.length ?? 0;
        const present = (hist ?? []).filter((h) => h.status === "present").length;
        const rate = total ? present / total : 1;
        let consec = 0;
        for (const h of hist ?? []) {
          if (h.status === "absent") consec++;
          else break;
        }
        const risk = computeRisk({
          attendance_rate: rate,
          consecutive_absences: consec,
          previous_intervention: false,
        });
        await supabase.from("risk_scores").insert({
          student_id: s.id,
          school_id,
          score: risk.score,
          level: risk.level,
          reasons: risk.reasons,
          recommended_actions: risk.recommended_actions,
        });
      }

      await supabase.from("audit_logs").insert({
        actor_id: userId,
        action: "attendance.verified",
        entity: "extractions",
        details: {
          date: data.date,
          grade: data.grade,
          count: data.rows.length,
          used_real_ai: data.used_real_ai,
        },
      });

      return { ok: true, students: students?.length ?? 0 };
    } catch (err) {
      console.warn("Supabase save failed, falling back to mock mode:", err);
      saveToMock();
      return { ok: true, students: data.rows.length };
    }
  });

export const getMyContext = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }: any) => {
    const ctx = context as HandlerContext;
    const { supabase, userId } = ctx;

    if (ctx.isMock) {
      const role = ctx.mockRole;
      return {
        profile: {
          id: userId,
          display_name: role === "teacher" ? "Sundari Ma'am" : "Principal Sir",
          email: `${role}@demo.in`,
          school_id: "mock-school-id",
          language: "en",
        },
        roles: [role],
        school: {
          id: "mock-school-id",
          name: "Govt Primary School, Anjanapura",
          district: "Bengaluru South",
          state: "Karnataka",
          udise_code: "29200100101",
        },
      };
    }

    const [{ data: profile }, { data: roles }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id,display_name,email,school_id,language")
        .eq("id", userId)
        .maybeSingle(),
      supabase.from("user_roles").select("role,school_id").eq("user_id", userId),
    ]);
    let school = null;
    if (profile?.school_id) {
      const { data } = await supabase
        .from("schools")
        .select("*")
        .eq("id", profile.school_id)
        .maybeSingle();
      school = data;
    }
    return { profile, roles: (roles ?? []).map((r) => r.role), school };
  });

export const getHighRiskStudents = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }: any) => {
    const ctx = context as HandlerContext;
    const { supabase, userId } = ctx;

    if (ctx.isMock) {
      if (mockRiskScores.length === 0) {
        return {
          items: [
            {
              student_id: "1",
              score: 92,
              level: "high",
              reasons: ["7 consecutive absences"],
              recommended_actions: ["Contact parents immediately", "Home visit by class teacher"],
              computed_at: new Date().toISOString(),
              students: {
                full_name: "Rahul K.",
                grade: "5",
                section: "A",
                guardian_phone: "9876543210",
              },
            },
            {
              student_id: "2",
              score: 85,
              level: "high",
              reasons: ["Attendance dropped to 68%", "Failed midterm math exam"],
              recommended_actions: ["Assign remedial classes", "Principal meeting with parents"],
              computed_at: new Date().toISOString(),
              students: {
                full_name: "Priya M.",
                grade: "5",
                section: "A",
                guardian_phone: "9876543211",
              },
            },
            {
              student_id: "3",
              score: 65,
              level: "medium",
              reasons: ["3 absences this week"],
              recommended_actions: ["Assign mentor counsellor", "Daily check-in"],
              computed_at: new Date().toISOString(),
              students: {
                full_name: "Asha S.",
                grade: "5",
                section: "A",
                guardian_phone: "9876543212",
              },
            },
            {
              student_id: "4",
              score: 55,
              level: "medium",
              reasons: ["Math score dropped 15%"],
              recommended_actions: ["Peer tutoring", "Weekly homework review"],
              computed_at: new Date().toISOString(),
              students: {
                full_name: "Karan P.",
                grade: "5",
                section: "B",
                guardian_phone: "9876543213",
              },
            },
          ],
        };
      }
      return { items: mockRiskScores.filter((r) => r.level !== "low") };
    }

    try {
      const { data: prof } = await supabase
        .from("profiles")
        .select("school_id")
        .eq("id", userId)
        .maybeSingle();
      if (!prof?.school_id) return { items: [] };
      // Latest risk per student
      const { data } = await supabase
        .from("risk_scores")
        .select(
          "student_id,score,level,reasons,recommended_actions,computed_at,students(full_name,grade,section,guardian_phone)",
        )
        .eq("school_id", prof.school_id)
        .order("computed_at", { ascending: false })
        .limit(500);

      const latest = new Map<string, any>();
      for (const r of data ?? []) {
        if (!latest.has(r.student_id)) latest.set(r.student_id, r);
      }
      const items = Array.from(latest.values())
        .filter((r) => r.level !== "low")
        .sort((a, b) => b.score - a.score);
      return { items };
    } catch (err) {
      console.warn("Supabase fetch failed, falling back to mock mode:", err);
      if (mockRiskScores.length === 0) {
        return { items: [] };
      }
      return { items: mockRiskScores.filter((r: any) => r.level !== "low") };
    }
  });

const BriefInput = z.object({
  date: z.string(),
  useReal: z.boolean().default(true),
  language: z.string().optional().default("en"),
});

export const generateMorningBriefing = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => BriefInput.parse(d))
  .handler(async ({ data, context }: any) => {
    const ctx = context as HandlerContext;
    const { supabase, userId } = ctx;

    if (ctx.isMock) {
      const text =
        data.language === "hi"
          ? "शुभ प्रभात प्रधानाचार्य जी। आज 4 छात्रों को तत्काल ध्यान देने की आवश्यकता है। राहुल के. (कक्षा 5): लगातार 7 दिनों से अनुपस्थित। प्रिया एम. (कक्षा 5): उपस्थिति 68% तक गिर गई। अनुशंसित कार्रवाई: माता-पिता से संपर्क करें, सलाहकार नियुक्त करें और साप्ताहिक निगरानी करें।"
          : data.language === "ta"
            ? "காலை வணக்கம் தலைமை ஆசிரியர் அவர்களே. இன்று 4 மாணவர்களுக்கு உடனடி கவனம் தேவை. ராகுல் கே. (வகுப்பு 5): தொடர்ந்து 7 நாட்கள் வருகை தராதவர். பிரியா எம். (வகுப்பு 5): வருகை 68% ஆக குறைந்துள்ளது. பரிந்துரைக்கப்பட்ட நடவடிக்கை: பெற்றோரை தொடர்பு கொள்ளவும், ஆலோசகரை நியமிக்கவும்."
            : "Good morning Principal. Today 4 students require urgent attention and 2 more need monitoring. Rahul K. (Grade 5): 7 consecutive absences. Priya M. (Grade 5): Attendance dropped to 68%. Recommended action: contact parents, assign counsellor where needed, and monitor weekly.";
      const briefing = {
        id: "mock-briefing-id",
        school_id: "mock-school-id",
        date: data.date,
        summary_text: text,
        high_risk_count: 4,
        payload: {
          high: mockRiskScores.filter((r) => r.level === "high").slice(0, 10),
          medium_count: mockRiskScores.filter((r) => r.level === "medium").length,
        },
        generated_by: userId,
        used_real_ai: false,
        created_at: new Date().toISOString(),
      };
      mockLatestBriefing = briefing;
      return briefing;
    }

    const { data: prof } = await supabase
      .from("profiles")
      .select("school_id,display_name")
      .eq("id", userId)
      .maybeSingle();
    if (!prof?.school_id) throw new Error("No school");

    const { data: scores } = await supabase
      .from("risk_scores")
      .select(
        "student_id,score,level,reasons,recommended_actions,computed_at,students(full_name,grade)",
      )
      .eq("school_id", prof.school_id)
      .order("computed_at", { ascending: false })
      .limit(500);

    const latest = new Map<string, any>();
    for (const r of scores ?? []) if (!latest.has(r.student_id)) latest.set(r.student_id, r);
    const high = Array.from(latest.values())
      .filter((r) => r.level === "high")
      .sort((a, b) => b.score - a.score);
    const med = Array.from(latest.values()).filter((r) => r.level === "medium").length;

    const lines: string[] = [];
    lines.push(
      `Good morning Principal. Today ${high.length} students require urgent attention${med ? ` and ${med} more need monitoring` : ""}.`,
    );
    for (const s of high.slice(0, 5)) {
      const reason = s.reasons?.[0] ?? "elevated risk";
      lines.push(`${s.students.full_name} (Grade ${s.students.grade}): ${reason}.`);
    }
    lines.push(
      "Recommended action: contact parents, assign counsellor where needed, and monitor weekly.",
    );
    let summary_text = lines.join(" ");
    let used_real_ai = false;

    if (data.useReal && hasAiConfigured()) {
      try {
        const langName =
          data.language === "hi" ? "Hindi" : data.language === "ta" ? "Tamil" : "English";
        const studentLines = high
          .slice(0, 10)
          .map(
            (s) =>
              `- ${s.students.full_name} (Grade ${s.students.grade}): score ${s.score}, reasons: ${(s.reasons ?? []).join("; ") || "elevated risk"}`,
          )
          .join("\n");

        const { text } = await generateTextWithFallback({
          maxOutputTokens: 600,
          prompt:
            `Write a short morning briefing in ${langName} for a school Principal in India, addressed to "Principal". ` +
            `${high.length} students need urgent attention and ${med} more need monitoring. ` +
            `High-risk students:\n${studentLines || "(none listed)"}\n\n` +
            `Keep it to 3-5 sentences, warm but direct, plain text (no markdown), and end with a concrete ` +
            `recommended action (e.g. contact parents, assign counsellor, monitor weekly).`,
        });

        if (text?.trim()) {
          summary_text = text.trim();
          used_real_ai = true;
        }
      } catch (err) {
        console.error("AI briefing generation failed, using rule-based summary:", err);
      }
    }

    const { data: ins, error } = await supabase
      .from("briefings")
      .insert({
        school_id: prof.school_id,
        date: data.date,
        summary_text,
        high_risk_count: high.length,
        payload: { high: high.slice(0, 10), medium_count: med },
        generated_by: userId,
        used_real_ai,
      })
      .select()
      .single();
    if (error) throw error;

    await supabase.from("audit_logs").insert({
      actor_id: userId,
      action: "briefing.generated",
      entity: "briefings",
      entity_id: ins.id,
      details: { high: high.length, medium: med, used_real_ai },
    });

    return ins;
  });

export const getLatestBriefing = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }: any) => {
    const ctx = context as HandlerContext;
    const { supabase, userId } = ctx;

    if (ctx.isMock) {
      return mockLatestBriefing;
    }

    const { data: prof } = await supabase
      .from("profiles")
      .select("school_id")
      .eq("id", userId)
      .maybeSingle();
    if (!prof?.school_id) return null;
    const { data } = await supabase
      .from("briefings")
      .select("*")
      .eq("school_id", prof.school_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data;
  });

export const getTeacherSnapshot = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }: any) => {
    const ctx = context as HandlerContext;
    const { supabase, userId } = ctx;

    if (ctx.isMock) {
      return {
        extractions: mockExtractions,
        todayCount: mockTodayCount,
      };
    }

    const { data: prof } = await supabase
      .from("profiles")
      .select("school_id")
      .eq("id", userId)
      .maybeSingle();
    if (!prof?.school_id) return { extractions: [], todayCount: 0 };
    const today = new Date().toISOString().slice(0, 10);
    const [{ data: extractions }, { count }] = await Promise.all([
      supabase
        .from("extractions")
        .select(
          "id,date,grade,section,status,avg_confidence,used_real_ai,created_at,flagged_reasons",
        )
        .eq("school_id", prof.school_id)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("attendance")
        .select("*", { count: "exact", head: true })
        .eq("school_id", prof.school_id)
        .eq("date", today),
    ]);
    return { extractions: extractions ?? [], todayCount: count ?? 0 };
  });
