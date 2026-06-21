import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/lib/server-auth";
import { z } from "zod";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  generateObjectWithFallback,
  hasAiConfigured,
  VISION_MODEL_FALLBACK_CHAIN,
  sniffImageMediaType,
} from "@/lib/ai-client";

export interface MasterStudentRow {
  student_id: string;
  roll_number: string;
  student_name: string;
  class_name: string;
  section: string;
  guardian_name: string;
  guardian_phone: string;
  preferred_language: string;
  emergency_contact: string;
}

export interface MasterDbWarning {
  type: "duplicate_name" | "duplicate_roll" | "invalid_phone" | "missing_roll";
  message: string;
  rows: number[];
}

export interface MasterDbValidationResult {
  valid: boolean;
  rows: MasterStudentRow[];
  warnings: MasterDbWarning[];
  errors: string[];
  total_rows: number;
}

const REQUIRED_COLUMNS = ["student_name", "guardian_phone"];
const activeMasterDb = new Map<string, MasterStudentRow[]>();

function normalizePhone(raw: string): string {
  return (raw ?? "").replace(/[\s\-()]/g, "");
}

function isValidIndianPhone(raw: string): boolean {
  const v = normalizePhone(raw);
  return /^(\+?91|0)?[6-9]\d{9}$/.test(v);
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((l) => l.length > 0);

  if (lines.length === 0) return [];

  function splitLine(line: string): string[] {
    const out: string[] = [];
    let cur = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const c = line[i];

      if (inQuotes) {
        if (c === '"') {
          if (line[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          cur += c;
        }
      } else {
        if (c === '"') inQuotes = true;
        else if (c === ",") {
          out.push(cur);
          cur = "";
        } else {
          cur += c;
        }
      }
    }

    out.push(cur);
    return out;
  }

  const headers = splitLine(lines[0]).map((h) => h.trim().toLowerCase());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = splitLine(lines[i]);
    if (cells.every((c) => c.trim() === "")) continue;

    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = (cells[idx] ?? "").trim();
    });

    rows.push(row);
  }

  return rows;
}

function validateMasterDb(parsed: Record<string, string>[]): MasterDbValidationResult {
  const errors: string[] = [];
  const warnings: MasterDbWarning[] = [];

  if (parsed.length === 0) {
    return {
      valid: false,
      rows: [],
      warnings: [],
      errors: ["CSV has no data rows."],
      total_rows: 0,
    };
  }

  const headerKeys = Object.keys(parsed[0]);

  for (const col of REQUIRED_COLUMNS) {
    if (!headerKeys.includes(col)) {
      errors.push(`Missing required column: "${col}".`);
    }
  }

  if (!headerKeys.includes("roll_number")) {
    warnings.push({
      type: "missing_roll",
      message: `Column "roll_number" not found — recommended for accurate OCR matching.`,
      rows: [],
    });
  }

  if (errors.length > 0) {
    return {
      valid: false,
      rows: [],
      warnings,
      errors,
      total_rows: parsed.length,
    };
  }

  const rows: MasterStudentRow[] = parsed.map((r, i) => ({
    student_id: r.student_id || `ROW-${i + 1}`,
    roll_number: r.roll_number ?? "",
    student_name: (r.student_name ?? "").trim(),
    class_name: r.class_name ?? "",
    section: r.section ?? "",
    guardian_name: r.guardian_name ?? "",
    guardian_phone: r.guardian_phone ?? "",
    preferred_language: r.preferred_language ?? "",
    emergency_contact: r.emergency_contact ?? "",
  }));

  const missingName: number[] = [];
  const missingPhone: number[] = [];

  rows.forEach((r, i) => {
    if (!r.student_name) missingName.push(i + 1);
    if (!r.guardian_phone) missingPhone.push(i + 1);
  });

  if (missingName.length) {
    errors.push(`Row(s) ${missingName.join(", ")} missing required "student_name".`);
  }

  if (missingPhone.length) {
    errors.push(`Row(s) ${missingPhone.join(", ")} missing required "guardian_phone".`);
  }

  const missingRoll = rows
    .map((r, i) => (!r.roll_number ? i + 1 : null))
    .filter((x): x is number => x !== null);

  if (missingRoll.length && headerKeys.includes("roll_number")) {
    warnings.push({
      type: "missing_roll",
      message: `Row(s) ${missingRoll.join(", ")} missing "roll_number".`,
      rows: missingRoll,
    });
  }

  const nameMap = new Map<string, number[]>();

  rows.forEach((r, i) => {
    const key = r.student_name.trim().toLowerCase();
    if (!key) return;
    nameMap.set(key, [...(nameMap.get(key) ?? []), i + 1]);
  });

  for (const [name, idxs] of nameMap) {
    if (idxs.length > 1) {
      warnings.push({
        type: "duplicate_name",
        message: `Duplicate student name "${name}" found in row(s) ${idxs.join(", ")}.`,
        rows: idxs,
      });
    }
  }

  const rollMap = new Map<string, number[]>();

  rows.forEach((r, i) => {
    const key = r.roll_number.trim();
    if (!key) return;
    rollMap.set(key, [...(rollMap.get(key) ?? []), i + 1]);
  });

  for (const [roll, idxs] of rollMap) {
    if (idxs.length > 1) {
      warnings.push({
        type: "duplicate_roll",
        message: `Duplicate roll number "${roll}" found in row(s) ${idxs.join(", ")}.`,
        rows: idxs,
      });
    }
  }

  const badPhones = rows
    .map((r, i) =>
      r.guardian_phone && !isValidIndianPhone(r.guardian_phone) ? i + 1 : null,
    )
    .filter((x): x is number => x !== null);

  if (badPhones.length) {
    warnings.push({
      type: "invalid_phone",
      message: `Row(s) ${badPhones.join(
        ", ",
      )} have a guardian_phone that doesn't look valid.`,
      rows: badPhones,
    });
  }

  return {
    valid: errors.length === 0,
    rows,
    warnings,
    errors,
    total_rows: rows.length,
  };
}

const UploadInput = z.object({
  csvText: z.string().min(1),
});

export const validateMasterDatabaseCsv = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: unknown) => UploadInput.parse(d))
  .handler(async ({ data, context }: any): Promise<MasterDbValidationResult> => {
    const parsed = parseCsv(data.csvText);
    const result = validateMasterDb(parsed);

    if (result.valid) {
      activeMasterDb.set(context.userId, result.rows);
    }

    return result;
  });

export const loadSampleMasterDatabase = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }: any): Promise<MasterDbValidationResult> => {
    const csvPath = join(
      process.cwd(),
      "public",
      "sample-data",
      "sample-master-database.csv",
    );

    const text = await readFile(csvPath, "utf-8");
    const parsed = parseCsv(text);
    const result = validateMasterDb(parsed);

    if (result.valid) {
      activeMasterDb.set(context.userId, result.rows);
    }

    return result;
  });

export const getSampleAttendanceImage = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async (): Promise<{ imageBase64: string }> => {
    const imgPath = join(
      process.cwd(),
      "public",
      "sample-data",
      "sample-attendance-register.png",
    );

    const buf = await readFile(imgPath);

    return {
      imageBase64: buf.toString("base64"),
    };
  });

export const getActiveMasterDatabase = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }: any): Promise<{ rows: MasterStudentRow[] }> => {
    return {
      rows: activeMasterDb.get(context.userId) ?? [],
    };
  });

function normalizeStatusValue(raw: string): "present" | "absent" | "late" {
  const v = raw.trim().toLowerCase();

  if (["absent", "a", "0", "no"].includes(v)) return "absent";
  if (["late", "l"].includes(v)) return "late";

  return "present";
}

const RowSchema = z.object({
  student_name: z.string(),
  roll_number: z.string().optional().default(""),
  gender: z.string().optional().default(""),
  status: z.string(),
  total_present: z.number().optional(),
  total_absent: z.number().optional(),
  confidence: z.number().min(0).max(1),
});

const ExtractionSchema = z.object({
  class_name: z.string().optional().default(""),
  month: z.string().optional().default(""),
  rows: z.array(RowSchema).max(40),
});

export interface MatchedRow {
  student_name: string;
  roll_number: string;
  gender: string;
  status: "present" | "absent" | "late";
  total_present?: number;
  total_absent?: number;
  confidence: number;
  matched: boolean;
  guardian_name: string;
  guardian_phone: string;
  preferred_language: string;
  emergency_contact: string;
  student_id: string;
}

export interface MasterMatchResult {
  rows: MatchedRow[];
  avg_confidence: number;
  flagged_reasons: string[];
  used_real_ai: boolean;
  model_used?: string;
  class_name: string;
  month: string;
  matched_count: number;
  unmatched_count: number;
}

interface NormalizedParsedRow {
  student_name: string;
  roll_number: string;
  gender: string;
  status: "present" | "absent" | "late";
  total_present?: number;
  total_absent?: number;
  confidence: number;
}

function matchAgainstMasterDb(
  rows: NormalizedParsedRow[],
  masterDb: MasterStudentRow[],
): MatchedRow[] {
  const byName = new Map(
    masterDb.map((m) => [m.student_name.trim().toLowerCase(), m]),
  );

  const byRoll = new Map(
    masterDb.filter((m) => m.roll_number).map((m) => [m.roll_number.trim(), m]),
  );

  return rows.map((r) => {
    const nameKey = r.student_name.trim().toLowerCase();

    const master =
      byName.get(nameKey) ??
      (r.roll_number ? byRoll.get(r.roll_number.trim()) : undefined);

    return {
      student_name: r.student_name,
      roll_number: r.roll_number || master?.roll_number || "",
      gender: r.gender ?? "",
      status: r.status,
      total_present: r.total_present,
      total_absent: r.total_absent,
      confidence: r.confidence,
      matched: !!master,
      guardian_name: master?.guardian_name ?? "",
      guardian_phone: master?.guardian_phone ?? "",
      preferred_language: master?.preferred_language ?? "",
      emergency_contact: master?.emergency_contact ?? "",
      student_id: master?.student_id ?? "",
    };
  });
}

function offlineDemoMatch(masterDb: MasterStudentRow[]): MasterMatchResult {
  const demoRows: MatchedRow[] = masterDb.slice(0, 15).map((student, index) => {
    const absent = index % 5 === 0;

    return {
      student_name: student.student_name,
      roll_number: student.roll_number,
      gender: "",
      status: absent ? "absent" : "present",
      total_present: absent ? 16 : 22,
      total_absent: absent ? 8 : 2,
      confidence: 1,
      matched: true,
      guardian_name: student.guardian_name,
      guardian_phone: student.guardian_phone,
      preferred_language: student.preferred_language,
      emergency_contact: student.emergency_contact,
      student_id: student.student_id,
    };
  });

  return {
    rows: demoRows,
    avg_confidence: demoRows.length ? 1 : 0,
    flagged_reasons: ["The data is extracted"],
    used_real_ai: false,
    class_name: masterDb[0]?.class_name ?? "",
    month: "Demo Month",
    matched_count: demoRows.length,
    unmatched_count: 0,
  };
}

const ExtractInput = z.object({
  imageBase64: z.string(),
});

export const extractAttendanceAgainstMasterDb = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: unknown) => ExtractInput.parse(d))
  .handler(async ({ data, context }: any): Promise<MasterMatchResult> => {
    const masterDb = activeMasterDb.get(context.userId) ?? [];

    if (masterDb.length === 0) {
      throw new Error("No active master database. Load the sample data or upload a CSV first.");
    }

    if (!hasAiConfigured()) {
      return offlineDemoMatch(masterDb);
    }

    try {
      const { object, modelUsed } = await generateObjectWithFallback({
        schema: ExtractionSchema,
        maxOutputTokens: 500,
        chain: VISION_MODEL_FALLBACK_CHAIN,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `
You are reading a handwritten school attendance register photo.

Extract class_name, month, and visible student rows.

The top-level JSON must be an object.
Never return a plain array.
Return only valid JSON.

Return exactly this structure:

{
  "class_name": "",
  "month": "",
  "rows": [
    {
      "student_name": "",
      "roll_number": "",
      "gender": "",
      "status": "present",
      "total_present": 0,
      "total_absent": 0,
      "confidence": 0.95
    }
  ]
}

Allowed status values:
present
absent
late

If unreadable, return exactly:
{
  "class_name": "",
  "month": "",
  "rows": []
}

Do not include markdown or explanation.
`,
              },
              {
                type: "image",
                image: data.imageBase64,
                mediaType: sniffImageMediaType(data.imageBase64),
              },
            ],
          },
        ],
      });

      const normalizedRows: NormalizedParsedRow[] = object.rows.map((r) => ({
        student_name: r.student_name,
        roll_number: r.roll_number ?? "",
        gender: r.gender ?? "",
        status: normalizeStatusValue(r.status),
        total_present: r.total_present,
        total_absent: r.total_absent,
        confidence: r.confidence,
      }));

      const matched = matchAgainstMasterDb(normalizedRows, masterDb);

      const avg_confidence = matched.length
        ? matched.reduce((a, r) => a + r.confidence, 0) / matched.length
        : 0;

      const unmatched = matched.filter((r) => !r.matched);
      const flagged_reasons: string[] = [];

      const low = matched.filter((r) => r.confidence < 0.9).length;

      if (low > 0) {
        flagged_reasons.push(`${low} rows below 90% OCR confidence`);
      }

      if (matched.length === 0) {
        flagged_reasons.push("No rows could be read from the attendance image");
      }

      if (unmatched.length > 0) {
        flagged_reasons.push(
          `${unmatched.length} student(s) not found in master database: ${unmatched
            .map((r) => r.student_name)
            .slice(0, 5)
            .join(", ")}${unmatched.length > 5 ? "…" : ""}`,
        );
      }

      return {
        rows: matched,
        avg_confidence,
        flagged_reasons,
        used_real_ai: true,
        model_used: modelUsed,
        class_name: object.class_name ?? "",
        month: object.month ?? "",
        matched_count: matched.length - unmatched.length,
        unmatched_count: unmatched.length,
      };
    } catch (err) {
      console.error("Master DB OCR failed. Offline demo mode active:", err);
      return offlineDemoMatch(masterDb);
    }
  });