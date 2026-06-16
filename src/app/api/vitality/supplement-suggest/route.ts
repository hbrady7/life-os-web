import { GoogleGenAI } from "@google/genai";
import { resolveGeminiApiKey } from "@/lib/gemini-key";
import { geminiErrorJsonResponse } from "@/lib/gemini-error";
import { getCurrentUser } from "@/lib/auth-server";
import { getUserContext, renderUserContext } from "@/lib/user-context";
import { listSupplements } from "@/lib/data/supplements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MODEL = "gemini-2.5-flash";

const SYSTEM_PROMPT = `You suggest evidence-based supplements for a fitness-focused user based on their recent data. Return JSON EXACTLY:
{ "suggestions": [ { "name": string, "dose": string, "rationale": string } ] }

Rules:
- 1 to 3 suggestions, most relevant first.
- Only well-studied, broadly safe supplements (e.g. creatine, magnesium glycinate, vitamin D, omega-3, electrolytes, melatonin). No megadoses, no obscure or risky compounds.
- Tie each rationale to a SPECIFIC signal in their data (poor sleep, high strain, low recovery, training volume). One short sentence.
- Do NOT suggest something already in their current stack (listed below).
- Keep dose practical (e.g. "5g daily", "300-400mg before bed").
- This is general wellness guidance, not medical advice.
Return ONLY the JSON, no markdown fences.`;

type Suggestion = { name: string; dose: string; rationale: string };

function stripFences(s: string): string {
  return s.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
}

function parse(raw: string): Suggestion[] {
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
    obj && typeof obj === "object" && Array.isArray((obj as { suggestions?: unknown }).suggestions)
      ? (obj as { suggestions: unknown[] }).suggestions
      : [];
  const out: Suggestion[] = [];
  for (const it of arr) {
    if (!it || typeof it !== "object") continue;
    const i = it as Record<string, unknown>;
    const name = typeof i.name === "string" ? i.name.trim() : "";
    if (!name) continue;
    out.push({
      name,
      dose: typeof i.dose === "string" ? i.dose.trim() : "",
      rationale: typeof i.rationale === "string" ? i.rationale.trim() : "",
    });
  }
  return out.slice(0, 3);
}

export async function POST() {
  const apiKey = resolveGeminiApiKey();
  if (!apiKey) return Response.json({ error: "missing-key" }, { status: 503 });

  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthenticated" }, { status: 401 });

  const [ctx, stack] = await Promise.all([
    getUserContext(user.id),
    listSupplements(user.id),
  ]);
  const stackBlock = stack.length
    ? stack.map((s) => `- ${s.name}`).join("\n")
    : "(empty)";

  const ai = new GoogleGenAI({ apiKey });
  let rawText = "";
  try {
    const result = (await ai.models.generateContent({
      model: MODEL,
      contents: [
        {
          role: "user",
          parts: [
            {
              text:
                SYSTEM_PROMPT +
                "\n\n--- CURRENT STACK ---\n" +
                stackBlock +
                "\n\n--- USER DATA ---\n" +
                renderUserContext(ctx),
            },
          ],
        },
      ],
      config: { temperature: 0.4, maxOutputTokens: 768, responseMimeType: "application/json" },
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
    console.error("[supplement-suggest] gemini call failed", err);
    return geminiErrorJsonResponse(err, "supplement_suggest");
  }

  return Response.json({ suggestions: parse(rawText) }, { status: 200 });
}
