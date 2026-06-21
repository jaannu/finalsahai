import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  generateObjectWithFallback,
  hasAiConfigured,
  VISION_MODEL_FALLBACK_CHAIN,
  TEXT_MODEL_FALLBACK_CHAIN,
  transcribeAudioWithFallback,
  sniffImageMediaType,
} from "@/lib/ai-client";

const Input = z.object({
  imageBase64: z.string().optional(),
  grade: z.string(),
  section: z.string().optional(),
  date: z.string(),
  useReal: z.boolean().default(true),
});

function normalizeStatusValue(raw: string): "present" | "absent" | "late" {
  const v = raw.trim().toLowerCase();
  if (["absent", "a", "0", "no"].includes(v)) return "absent";
  if (["late", "l"].includes(v)) return "late";
  return "present";
}

const RowSchema = z.object({
  student_name: z.string(),
  grade: z.string(),
  gender: z.string().optional().default(""),
  status: z.string(),
  confidence: z.number().min(0).max(1),
});

const ExtractionSchema = z.object({
  rows: z.array(RowSchema).max(40),
});

export interface Row {
  student_name: string;
  grade: string;
  gender: string;
  status: "present" | "absent" | "late";
  confidence: number;
}

export type ExtractionResult = {
  rows: Row[];
  avg_confidence: number;
  flagged_reasons: string[];
  used_real_ai: boolean;
  model_used?: string;
};

function mockExtract(grade: string): ExtractionResult {
  const names = [
    "Rahul Kumar",
    "Priya Mehta",
    "Asha Singh",
    "Karan Patel",
    "Meena Iyer",
    "Vivek Sharma",
    "Sunita Devi",
    "Arjun Reddy",
    "Lakshmi Nair",
    "Ravi Verma",
    "Pooja Gupta",
    "Aman Khan",
    "Neha Joshi",
    "Suresh Yadav",
    "Anita Roy",
  ];

  const rows: Row[] = names.map((n, i) => ({
    student_name: n,
    grade,
    gender: i % 2 === 0 ? "M" : "F",
    status: i === 0 || i === 2 || i === 7 ? "absent" : "present",
    confidence: 1,
  }));

  const avg = rows.length
    ? rows.reduce((a, r) => a + r.confidence, 0) / rows.length
    : 0;

  return {
    rows,
    avg_confidence: avg,
    flagged_reasons: [],
    used_real_ai: false,
  };
}

function summarizeFlags(rows: Row[]): string[] {
  const flags: string[] = [];
  const low = rows.filter((r) => r.confidence < 0.9).length;

  if (low > 0) flags.push(`${low} rows below 90% OCR confidence`);
  if (rows.length === 0) flags.push("No rows could be read from the image");

  return flags;
}

async function realExtract(
  imageBase64: string,
  grade: string,
): Promise<ExtractionResult> {
  const { object, modelUsed } = await generateObjectWithFallback({
    schema: ExtractionSchema,
    maxOutputTokens: 600,
    chain: VISION_MODEL_FALLBACK_CHAIN,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `
You are reading a school attendance register photo for grade ${grade}.

Extract only clearly visible student rows.

The top-level JSON must be an object with key "rows".
Never return a plain array.
Return only valid JSON.

Return exactly this structure:

{
  "rows": [
    {
      "student_name": "",
      "grade": "${grade}",
      "gender": "",
      "status": "present",
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
  "rows": []
}

Do not include markdown.
Do not include explanation.
`,
          },
          {
            type: "image",
            image: imageBase64,
            mediaType: sniffImageMediaType(imageBase64),
          },
        ],
      },
    ],
  });

  const rows: Row[] = object.rows.map((r) => ({
    ...r,
    grade,
    gender: r.gender ?? "",
    status: normalizeStatusValue(r.status),
  }));

  const avg_confidence = rows.length
    ? rows.reduce((a, r) => a + r.confidence, 0) / rows.length
    : 0;

  return {
    rows,
    avg_confidence,
    flagged_reasons: summarizeFlags(rows),
    used_real_ai: true,
    model_used: modelUsed,
  };
}

export const extractAttendance = createServerFn({ method: "POST" })
  .validator((d: unknown) => Input.parse(d))
  .handler(async ({ data }: any): Promise<ExtractionResult> => {
    if (data.useReal && data.imageBase64 && hasAiConfigured()) {
      try {
        return await realExtract(data.imageBase64, data.grade);
      } catch (err) {
        console.error("AI extraction failed. Offline demo mode active:", err);

        const fallback = mockExtract(data.grade);

        fallback.flagged_reasons.unshift(
          "AI unavailable. Offline demo mode is active.",
        );

        return fallback;
      }
    }

    const fallback = mockExtract(data.grade);
    fallback.flagged_reasons.unshift("Offline demo mode is active.");
    return fallback;
  });

const TranscribeInput = z.object({
  audioBase64: z.string().min(1),
  format: z.string().default("webm"),
});

export const transcribeVoice = createServerFn({ method: "POST" })
  .validator((d: unknown) => TranscribeInput.parse(d))
  .handler(async ({ data }: any): Promise<{ text: string; modelUsed?: string }> => {
    if (!hasAiConfigured()) {
      return {
        text: "Rahul Kumar absent, Priya Mehta present, Asha Singh absent, Karan Patel present",
        modelUsed: "offline-demo",
      };
    }

    try {
      const { text, modelUsed } = await transcribeAudioWithFallback({
        audioBase64: data.audioBase64,
        format: data.format,
        prompt:
          "This is a teacher reading out school attendance: student names and present/absent status.",
      });

      return { text, modelUsed };
    } catch (err) {
      console.error("Voice transcription failed. Offline demo mode active:", err);

      return {
        text: "Rahul Kumar absent, Priya Mehta present, Asha Singh absent, Karan Patel present",
        modelUsed: "offline-demo",
      };
    }
  });

const VoiceInput = z.object({
  transcript: z.string().min(1),
  grade: z.string(),
  section: z.string().optional(),
});

export const extractAttendanceFromTranscript = createServerFn({ method: "POST" })
  .validator((d: unknown) => VoiceInput.parse(d))
  .handler(async ({ data }: any): Promise<ExtractionResult> => {
    if (!hasAiConfigured()) {
      const fallback = mockExtract(data.grade);
      fallback.flagged_reasons.unshift("Offline demo mode is active.");
      return fallback;
    }

    try {
      const { object, modelUsed } = await generateObjectWithFallback({
        schema: ExtractionSchema,
        maxOutputTokens: 500,
        chain: TEXT_MODEL_FALLBACK_CHAIN,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `
A teacher dictated today's attendance for grade ${data.grade}.

Transcript:
"""${data.transcript}"""

Extract every student mentioned into attendance rows.

The top-level JSON must be an object with key "rows".
Never return a plain array.
Return only valid JSON.

Return exactly this structure:

{
  "rows": [
    {
      "student_name": "",
      "grade": "${data.grade}",
      "gender": "",
      "status": "present",
      "confidence": 0.95
    }
  ]
}

Allowed status values:
present
absent
late

If no students are found, return exactly:
{
  "rows": []
}

Do not include markdown.
Do not include explanation.
`,
              },
            ],
          },
        ],
      });

      const rows: Row[] = object.rows.map((r) => ({
        ...r,
        grade: data.grade,
        gender: r.gender ?? "",
        status: normalizeStatusValue(r.status),
      }));

      const avg_confidence = rows.length
        ? rows.reduce((a, r) => a + r.confidence, 0) / rows.length
        : 0;

      return {
        rows,
        avg_confidence,
        flagged_reasons: summarizeFlags(rows),
        used_real_ai: true,
        model_used: modelUsed,
      };
    } catch (err) {
      console.error("Voice extraction failed. Offline demo mode active:", err);

      const fallback = mockExtract(data.grade);

      fallback.flagged_reasons.unshift(
        "AI unavailable. Offline demo mode is active.",
      );

      return fallback;
    }
  });

const ImportRowInput = z.object({
  student_name: z.string(),
  status: z.string().optional(),
  gender: z.string().optional(),
});

const ImportInput = z.object({
  rows: z.array(ImportRowInput).max(200),
  grade: z.string(),
});

function normalizeStatus(raw: string | undefined): "present" | "absent" | "late" {
  const v = (raw ?? "").trim().toLowerCase();

  if (["a", "absent", "ab", "0"].includes(v)) return "absent";
  if (["l", "late"].includes(v)) return "late";

  return "present";
}

export const importAttendanceRows = createServerFn({ method: "POST" })
  .validator((d: unknown) => ImportInput.parse(d))
  .handler(async ({ data }: any): Promise<ExtractionResult> => {
    const rows: Row[] = data.rows
      .filter((r: { student_name: string }) => r.student_name?.trim())
      .map((r: { student_name: string; status?: string; gender?: string }) => ({
        student_name: r.student_name.trim(),
        grade: data.grade,
        gender: (r.gender ?? "").trim(),
        status: normalizeStatus(r.status),
        confidence: 1,
      }));

    return {
      rows,
      avg_confidence: rows.length ? 1 : 0,
      flagged_reasons: rows.length
        ? []
        : ["No valid rows found in the imported file"],
      used_real_ai: false,
    };
  });