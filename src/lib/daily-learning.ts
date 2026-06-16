/**
 * "How ordinary things are made" — daily, auto-rotating, app-wide.
 *
 * getTodaysLearning() returns today's row, generating + inserting it once
 * via Gemini if it doesn't exist yet. Stable for the whole day (never
 * regenerates per page load) and accretes an archive. The UNIQUE(date)
 * constraint makes the lazy generation safe under concurrent first-loads:
 * the loser's insert is a no-op and we re-read the winner's row.
 */

import { GoogleGenAI } from "@google/genai";
import { resolveGeminiApiKey } from "@/lib/gemini-key";
import { todayStr } from "@/lib/date";
import {
  getLearningByDate,
  insertLearning,
  recentSubjects,
  type DailyLearningRow,
} from "@/lib/data/daily-learnings";

const MODEL = "gemini-2.5-flash";

const SYSTEM_PROMPT = `You write a short daily explainer titled "How it's made". Pick ONE ordinary, everyday object, material, or food and explain clearly and engagingly how it's actually made or produced — the real process, concrete steps, and a surprising detail or two. A few tight paragraphs, plain and vivid, no fluff, no bullet lists. Assume a curious adult reader.

Return strict JSON EXACTLY:
{ "subject": string, "body": string }

- "subject" is the thing itself, a few words (e.g. "Aluminum foil", "Crayons", "Cane sugar", "Mirrors", "Saffron").
- "body" is the explanation, ~3 short paragraphs separated by blank lines.
- Pick something genuinely ordinary that most people have never thought about how it's made.
Return ONLY the JSON, no markdown fences.`;

function stripFences(s: string): string {
  return s.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
}

function parse(raw: string): { subject: string; body: string } | null {
  const tryParse = (s: string) => {
    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  };
  let obj = tryParse(raw) ?? tryParse(stripFences(raw));
  if (!obj) {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) obj = tryParse(m[0]);
  }
  if (!obj || typeof obj !== "object") return null;
  const o = obj as Record<string, unknown>;
  const subject = typeof o.subject === "string" ? o.subject.trim() : "";
  const body = typeof o.body === "string" ? o.body.trim() : "";
  if (!subject || !body) return null;
  return { subject, body };
}

/** Generate a fresh learning, avoiding recently used subjects. Returns
 * null if the LLM is unconfigured or the call fails. */
export async function generateDailyLearning(): Promise<{
  subject: string;
  body: string;
} | null> {
  const apiKey = resolveGeminiApiKey();
  if (!apiKey) return null;

  const used = await recentSubjects(60);
  const avoidBlock = used.length
    ? `\n\nDo NOT pick any of these already-used subjects:\n${used.map((s) => `- ${s}`).join("\n")}`
    : "";

  const ai = new GoogleGenAI({ apiKey });
  try {
    const result = (await ai.models.generateContent({
      model: MODEL,
      contents: [{ role: "user", parts: [{ text: SYSTEM_PROMPT + avoidBlock }] }],
      config: { temperature: 0.9, maxOutputTokens: 1024, responseMimeType: "application/json" },
    })) as unknown as {
      text?: string;
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    let rawText = result.text ?? "";
    if (!rawText) {
      const parts = result.candidates?.[0]?.content?.parts;
      rawText = parts?.map((p) => p.text ?? "").join("") ?? "";
    }
    return parse(rawText);
  } catch (err) {
    console.error("[daily-learning] generation failed", err);
    return null;
  }
}

/** Today's learning, generating + persisting it once if absent. */
export async function getTodaysLearning(
  date: string = todayStr()
): Promise<DailyLearningRow | null> {
  const existing = await getLearningByDate(date);
  if (existing) return existing;

  const generated = await generateDailyLearning();
  if (!generated) return null;

  await insertLearning({ date, subject: generated.subject, body: generated.body });
  // Re-read so concurrent first-loads converge on the same persisted row.
  return getLearningByDate(date);
}
