import { NextRequest } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";
import { resolveGeminiApiKey } from "@/lib/gemini-key";
import { classifyGeminiError } from "@/lib/gemini-error";
import { withUserRequest } from "@/lib/api-helpers";
import { insertFact, listFacts } from "@/lib/data/user-facts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// flash-lite: this route fires fire-and-forget after every Overseer turn,
// which on `flash` (20 RPD free tier) would burn through the whole daily
// quota in a single chat session. Lite has 1000 RPD and easily handles
// the small structured extraction task.
const MODEL = "gemini-2.5-flash-lite";

const EXTRACT_SYSTEM = `You extract DURABLE facts about a user from their messages to a coaching assistant. Durable means stable across sessions — true a month from now, not just today.

INCLUDE:
- Goals/projects with a known timeframe ("training for a marathon in November")
- Names of important people / pets ("my dog is Daisy", "my partner Sam")
- Ongoing constraints ("vegetarian", "lactose intolerant", "no caffeine after 2pm")
- Long-running preferences ("prefers morning workouts", "lifts 4× a week")
- Locations / context ("lives in Brooklyn", "remote worker")
- Equipment / setup ("has a home gym with a barbell + rack")

EXCLUDE:
- Transient state ("feeling tired today", "had a rough sleep")
- Things already in the existing facts list (case-insensitive substring match is enough)
- Questions / hypotheticals / future plans expressed as "maybe"
- Inferred attributes the user didn't state (no health/identity guessing)
- Anything sensitive the user didn't volunteer

Return only NEW facts that aren't covered by the existing list. If the message contains no durable facts, return an empty array.

Each fact: ONE short sentence, present tense, written about the user in third person (e.g. "Training for a marathon in November", not "I'm training…"). Optional category: one of "fitness", "personal", "work", "health", "preference", "context".`;

export async function POST(req: NextRequest) {
  return withUserRequest(req, async ({ userId, body }): Promise<unknown> => {
    const apiKey = resolveGeminiApiKey();
    if (!apiKey) {
      return { ok: false, error: "missing_key", inserted: [] };
    }

    const input = body as
      | { userMessage?: string; assistantMessage?: string }
      | undefined;
    const userMessage = input?.userMessage?.trim();
    if (!userMessage) return { ok: false, error: "missing_message", inserted: [] };

    const existing = await listFacts(userId);
    const existingList = existing.length
      ? existing.map((f, i) => `${i + 1}. ${f.value.text}`).join("\n")
      : "(none)";

    const ai = new GoogleGenAI({ apiKey });

    let response;
    try {
      response = await ai.models.generateContent({
        model: MODEL,
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `Existing facts:\n${existingList}\n\nUser message:\n${userMessage}${
                  input?.assistantMessage
                    ? `\n\nAssistant reply (context only — extract facts only from the user message):\n${input.assistantMessage.slice(0, 800)}`
                    : ""
                }`,
              },
            ],
          },
        ],
        config: {
          systemInstruction: EXTRACT_SYSTEM,
          temperature: 0.1,
          maxOutputTokens: 512,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              facts: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    text: { type: Type.STRING },
                    category: { type: Type.STRING },
                  },
                  required: ["text"],
                },
              },
            },
            required: ["facts"],
          },
        },
      });
    } catch (err) {
      // Fire-and-forget caller doesn't surface this — but tagging the
      // classification gives us observability when reviewing server logs.
      const kind = classifyGeminiError(err);
      console.error(`[user-facts/extract] gemini ${kind}`, err);
      return { ok: false, error: kind, inserted: [] };
    }

    const text = response.text ?? "";
    if (!text) return { ok: true, inserted: [] };

    let parsed: { facts: Array<{ text: string; category?: string }> };
    try {
      parsed = JSON.parse(text);
    } catch {
      return { ok: false, error: "parse_failed", inserted: [] };
    }
    if (!Array.isArray(parsed.facts)) return { ok: true, inserted: [] };

    // Belt-and-suspenders dedup: even though the prompt tells the model
    // to skip duplicates, lowercase-substring guard catches cases where
    // Gemini paraphrases a fact we already store.
    const existingLowered = existing.map((f) => f.value.text.toLowerCase());
    const inserted = [];
    for (const f of parsed.facts) {
      const t = f.text?.trim();
      if (!t) continue;
      const lc = t.toLowerCase();
      const isDup = existingLowered.some(
        (e) => e === lc || e.includes(lc) || lc.includes(e)
      );
      if (isDup) continue;
      const row = await insertFact(userId, {
        text: t,
        ...(f.category ? { category: f.category } : {}),
      });
      inserted.push(row);
      existingLowered.push(lc);
    }

    return { ok: true, inserted };
  });
}
