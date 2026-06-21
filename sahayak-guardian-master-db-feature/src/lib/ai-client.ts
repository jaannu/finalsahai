import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateObject as aiGenerateObject, generateText as aiGenerateText } from "ai";
import type { LanguageModel } from "ai";
import type { z } from "zod";

let cachedProvider: ReturnType<typeof createOpenAICompatible> | null = null;

function getProvider() {
  if (cachedProvider) return cachedProvider;

  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set in .env");
  }

  cachedProvider = createOpenAICompatible({
    name: "openrouter",
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
    headers: {
      "HTTP-Referer": process.env.APP_URL ?? "http://localhost:3000",
      "X-Title": "Sahayak Guardian",
    },
  });

  return cachedProvider;
}

export const DEFAULT_TEXT_MODEL = "google/gemini-2.5-flash-lite";
export const DEFAULT_VISION_MODEL = "google/gemini-2.5-flash";

export const TEXT_MODEL_FALLBACK_CHAIN: string[] = [
  "google/gemini-2.5-flash-lite",
  "google/gemini-2.5-flash",
  "meta-llama/llama-3.3-70b-instruct",
];

export const VISION_MODEL_FALLBACK_CHAIN: string[] = [
  "google/gemini-2.5-flash",
  "google/gemini-2.5-flash-lite",
  "google/gemini-2.5-pro",
];

export function sniffImageMediaType(base64: string): string {
  const head = base64.slice(0, 16);

  if (head.startsWith("/9j/")) return "image/jpeg";
  if (head.startsWith("iVBORw0KGgo")) return "image/png";
  if (head.startsWith("R0lGODlh") || head.startsWith("R0lGODdh")) return "image/gif";
  if (head.startsWith("UklGR")) return "image/webp";

  return "image/jpeg";
}

export function hasAiConfigured(): boolean {
  return !!process.env.OPENROUTER_API_KEY;
}

export function getModel(modelId: string = DEFAULT_TEXT_MODEL): LanguageModel {
  return getProvider()(modelId);
}

function isRetryableModelError(err: unknown): boolean {
  const status =
    (err as { statusCode?: number; status?: number })?.statusCode ??
    (err as { statusCode?: number; status?: number })?.status;

  if (status && [402, 404, 408, 429, 500, 502, 503, 504].includes(status)) {
    return true;
  }

  const name = (err as { name?: string })?.name ?? "";

  if (name === "AI_NoObjectGeneratedError" || name === "AI_TypeValidationError") {
    return true;
  }

  const msg = String((err as { message?: string })?.message ?? err ?? "").toLowerCase();

  return (
    msg.includes("credits") ||
    msg.includes("rate limit") ||
    msg.includes("overloaded") ||
    msg.includes("unavailable") ||
    msg.includes("timeout") ||
    msg.includes("no object generated") ||
    msg.includes("could not parse") ||
    msg.includes("response did not match schema") ||
    msg.includes("type validation failed") ||
    msg.includes("invalid_type") ||
    msg.includes("invalid_enum_value")
  );
}

export async function generateObjectWithFallback<T>(opts: {
  schema: z.ZodType<T>;
  messages: NonNullable<Parameters<typeof aiGenerateObject>[0]["messages"]>;
  maxOutputTokens?: number;
  chain?: string[];
}): Promise<{ object: T; modelUsed: string }> {
  const chain = opts.chain ?? TEXT_MODEL_FALLBACK_CHAIN;
  let lastErr: unknown;

  for (const modelId of chain) {
    try {
      const { object } = await aiGenerateObject({
        model: getModel(modelId),
        schema: opts.schema,
        output: "object",
        maxOutputTokens: opts.maxOutputTokens ?? 1200,
        messages: opts.messages,
      });

      return { object, modelUsed: modelId };
    } catch (err) {
      lastErr = err;

      if (!isRetryableModelError(err)) {
        throw err;
      }

      console.warn(`Model ${modelId} failed, trying next model:`, err);
    }
  }

  throw lastErr;
}

export async function generateTextWithFallback(opts: {
  prompt: string;
  maxOutputTokens?: number;
  chain?: string[];
}): Promise<{ text: string; modelUsed: string }> {
  const chain = opts.chain ?? TEXT_MODEL_FALLBACK_CHAIN;
  let lastErr: unknown;

  for (const modelId of chain) {
    try {
      const { text } = await aiGenerateText({
        model: getModel(modelId),
        maxOutputTokens: opts.maxOutputTokens ?? 1200,
        prompt: opts.prompt,
      });

      return { text, modelUsed: modelId };
    } catch (err) {
      lastErr = err;

      if (!isRetryableModelError(err)) {
        throw err;
      }

      console.warn(`Model ${modelId} failed, trying next model:`, err);
    }
  }

  throw lastErr;
}

const AUDIO_MODEL_FALLBACK_CHAIN: string[] = [
  "openai/whisper-1",
  "openai/gpt-4o-mini-transcribe",
];

export async function transcribeAudioWithFallback(opts: {
  audioBase64: string;
  format: string;
  prompt?: string;
}): Promise<{ text: string; modelUsed: string }> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set.");
  }

  let lastErr: unknown;

  for (const modelId of AUDIO_MODEL_FALLBACK_CHAIN) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.APP_URL ?? "http://localhost:3000",
          "X-Title": "Sahayak Guardian",
        },
        body: JSON.stringify({
          model: modelId,
          file: opts.audioBase64,
          file_format: opts.format,
          prompt: opts.prompt,
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        const err = new Error(`Transcription failed (${res.status}): ${body}`);
        (err as { statusCode?: number }).statusCode = res.status;
        throw err;
      }

      const data = (await res.json()) as { text?: string };

      if (!data.text?.trim()) {
        throw new Error("Transcription returned empty text");
      }

      return {
        text: data.text.trim(),
        modelUsed: modelId,
      };
    } catch (err) {
      lastErr = err;

      if (!isRetryableModelError(err)) {
        throw err;
      }

      console.warn(`Audio model ${modelId} failed, trying next:`, err);
    }
  }

  throw lastErr;
}