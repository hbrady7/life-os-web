import { GoogleGenAI } from "@google/genai";
import { resolveGeminiApiKey, GEMINI_KEY_NAMES } from "@/lib/gemini-key";
import { geminiErrorJsonResponse } from "@/lib/gemini-error";
import { getCurrentUser } from "@/lib/auth-server";
import { createPlanBlocks, type Difficulty } from "@/lib/data/plan-blocks";
import { todayStr } from "@/lib/date";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MODEL = "gemini-2.5-flash";

const SYSTEM_PROMPT = `You parse a free-text day plan into structured time blocks. Return JSON EXACTLY:
{ "blocks": [ { "task": string, "start": "HH:MM", "end": "HH:MM", "difficulty": "easy" | "medium" | "hard" } ] }

Rules:
- 24-hour times. "9 to 11" → 09:00–11:00. "1930" → 19:30. "gym 1930" with no end → assume 60 min (19:30–20:30).
- If only a start is given, assume a 60-minute block.
- Infer difficulty from wording: "deep work", "hard", "heavy", "intense" → hard; "easy", "light", "chill", "read", "admin" → easy; otherwise medium.
- "30m" / "30 min" is a duration; place it sensibly after the previous block if no time given, else medium difficulty 60 min from now.
- Keep task names short (a few words).
Return ONLY the JSON, no markdown fences.`;

type ParsedBlock = { task: string; start: string; end: string; difficulty: Difficulty };

function stripFences(s: string): string {
  return s
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
}

function hhmmToMin(s: unknown): number | null {
  if (typeof s !== "string") return null;
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

function toDifficulty(v: unknown): Difficulty {
  return v === "easy" || v === "hard" ? v : "medium";
}

function parseBlocks(raw: string): ParsedBlock[] {
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
  const arr =
    obj && typeof obj === "object" && Array.isArray((obj as { blocks?: unknown }).blocks)
      ? ((obj as { blocks: unknown[] }).blocks)
      : [];
  const out: ParsedBlock[] = [];
  for (const it of arr) {
    if (!it || typeof it !== "object") continue;
    const i = it as Record<string, unknown>;
    const task = typeof i.task === "string" ? i.task.trim() : "";
    if (!task) continue;
    out.push({
      task,
      start: typeof i.start === "string" ? i.start : "",
      end: typeof i.end === "string" ? i.end : "",
      difficulty: toDifficulty(i.difficulty),
    });
  }
  return out;
}

export async function POST(req: Request) {
  const apiKey = resolveGeminiApiKey();
  if (!apiKey) {
    return Response.json(
      {
        error: "missing-key",
        message: `No Gemini API key found. Set one of: ${GEMINI_KEY_NAMES.join(", ")}.`,
      },
      { status: 503 }
    );
  }

  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthenticated" }, { status: 401 });

  let body: { text?: string; date?: string };
  try {
    body = (await req.json()) as { text?: string; date?: string };
  } catch {
    return Response.json({ error: "bad-request" }, { status: 400 });
  }
  const text = body?.text?.trim();
  if (!text) return Response.json({ error: "empty" }, { status: 400 });
  const date = body.date ?? todayStr();

  const ai = new GoogleGenAI({ apiKey });
  let rawText = "";
  try {
    const result = (await ai.models.generateContent({
      model: MODEL,
      contents: [{ role: "user", parts: [{ text: `${SYSTEM_PROMPT}\n\nPlan: ${text}` }] }],
      config: {
        temperature: 0.2,
        maxOutputTokens: 1024,
        responseMimeType: "application/json",
      },
    })) as unknown as {
      text?: string;
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    rawText = result.text ?? "";
    if (!rawText) {
      const parts = result.candidates?.[0]?.content?.parts;
      rawText = parts?.map((p) => p.text ?? "").join("") ?? "";
    }
  } catch (err) {
    console.error("[plan-parse] gemini call failed", err);
    return geminiErrorJsonResponse(err, "plan_parse");
  }

  const parsed = parseBlocks(rawText)
    .map((b) => {
      const startMin = hhmmToMin(b.start);
      let endMin = hhmmToMin(b.end);
      if (startMin == null) return null;
      if (endMin == null || endMin <= startMin) endMin = Math.min(24 * 60, startMin + 60);
      return { task: b.task, startMin, endMin, difficulty: b.difficulty };
    })
    .filter((b): b is NonNullable<typeof b> => b !== null);

  if (parsed.length === 0) {
    return Response.json(
      { error: "no-blocks", message: "Couldn't find any time blocks in that." },
      { status: 422 }
    );
  }

  const created = await createPlanBlocks(user.id, date, parsed);
  return Response.json(created, { status: 200 });
}
