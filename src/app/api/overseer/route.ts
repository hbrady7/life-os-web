import { GoogleGenAI } from "@google/genai";
import type { LifeOSData } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type RequestBody = {
  messages: ChatMessage[];
  context: LifeOSData;
};

const MODEL = "gemini-2.5-flash";

function buildSystemPrompt(ctx: LifeOSData) {
  const today = new Date().toISOString().slice(0, 10);
  const goalsRendered = ctx.goals.length
    ? ctx.goals
        .map((g) => `  - [${g.done ? "x" : " "}] ${g.text}`)
        .join("\n")
    : "  (none)";
  const renderList = (items: { text: string }[]) =>
    items.length ? items.map((i) => `  - ${i.text}`).join("\n") : "  (none)";

  return [
    "You are Overseer — a calm, direct personal-coach assistant embedded in the user's daily life-OS dashboard.",
    "Speak like a sharp friend: warm, terse, specific. No corporate fluff, no bullet lists unless they truly help, no preamble. Default to a sentence or two unless asked to go deeper.",
    "You can see the user's day at a glance via the context below. Reference it concretely (e.g. \"finish the second goal first\") rather than giving generic advice. If the user asks \"what should I focus on next?\", pick one item and say why.",
    "Never invent goals or wins the user didn't write. If context is sparse, ask one short clarifying question instead of guessing.",
    "",
    `Today: ${today}`,
    `Day type: ${ctx.dayType || "(unset)"}`,
    `Reminder banner: ${ctx.reminder || "(unset)"}`,
    "",
    "Goals for today:",
    goalsRendered,
    "",
    "Plan for tomorrow:",
    renderList(ctx.planTomorrow),
    "",
    "Wins & positives:",
    renderList(ctx.wins),
    "",
    "Current struggles:",
    renderList(ctx.struggles),
  ].join("\n");
}

function toGenAIContents(messages: ChatMessage[]) {
  return messages
    .filter((m) => m.content.trim().length > 0)
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
}

export async function POST(req: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(
      "Server is missing GEMINI_API_KEY. Add it to .env.local or your Vercel project's environment variables.",
      { status: 500 }
    );
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  if (!body?.messages?.length) {
    return new Response("No messages provided", { status: 400 });
  }

  const ai = new GoogleGenAI({ apiKey });

  const systemInstruction = buildSystemPrompt(body.context);
  const contents = toGenAIContents(body.messages);

  type StreamChunk = {
    text?: string;
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };

  const extractText = (chunk: StreamChunk): string => {
    if (typeof chunk.text === "string" && chunk.text.length > 0) {
      return chunk.text;
    }
    const parts = chunk.candidates?.[0]?.content?.parts;
    if (!parts) return "";
    return parts.map((p) => p.text ?? "").join("");
  };

  let streamIter: AsyncIterable<StreamChunk>;
  try {
    streamIter = (await ai.models.generateContentStream({
      model: MODEL,
      contents,
      config: {
        systemInstruction,
        temperature: 0.7,
        maxOutputTokens: 1024,
      },
    })) as unknown as AsyncIterable<StreamChunk>;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Gemini call failed";
    return new Response(msg, { status: 502 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of streamIter) {
          const text = extractText(chunk);
          if (text) controller.enqueue(encoder.encode(text));
        }
        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "stream error";
        controller.enqueue(encoder.encode(`\n\n[stream error: ${msg}]`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
