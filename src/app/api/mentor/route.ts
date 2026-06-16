import { GoogleGenAI } from "@google/genai";
import { MENTOR_SYSTEM } from "@/lib/prompts";
import { resolveGeminiApiKey } from "@/lib/gemini-key";
import {
  classifyGeminiError,
  geminiErrorPlainResponse,
  withGeminiRetry,
} from "@/lib/gemini-error";
import { getCurrentUser } from "@/lib/auth-server";
import { getUserContext, renderUserContext } from "@/lib/user-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChatMessage = { role: "user" | "assistant"; content: string };
type Body = { messages: ChatMessage[] };

type StreamChunk = {
  text?: string;
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
};

const MODEL = "gemini-2.5-flash";

function extractText(chunk: StreamChunk): string {
  if (typeof chunk.text === "string" && chunk.text.length > 0) return chunk.text;
  const parts = chunk.candidates?.[0]?.content?.parts;
  return parts ? parts.map((p) => p.text ?? "").join("") : "";
}

export async function POST(req: Request) {
  const apiKey = resolveGeminiApiKey();
  if (!apiKey) return new Response("missing-key", { status: 503 });

  const user = await getCurrentUser();
  if (!user) return new Response("unauthenticated", { status: 401 });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }
  if (!body?.messages?.length) return new Response("No messages", { status: 400 });

  // Build the full context fresh each turn so the Mentor always reflects
  // the latest logs + memories — same discipline as the overseer route.
  const ctx = await getUserContext(user.id);
  const systemInstruction =
    MENTOR_SYSTEM +
    "\n\n--- WHAT YOU KNOW ABOUT THIS USER RIGHT NOW ---\n" +
    renderUserContext(ctx);

  const contents = body.messages
    .filter((m) => m.content.trim().length > 0)
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  const ai = new GoogleGenAI({ apiKey });

  let stream: AsyncIterable<StreamChunk>;
  try {
    stream = (await withGeminiRetry(() =>
      ai.models.generateContentStream({
        model: MODEL,
        contents,
        config: { systemInstruction, temperature: 0.7, maxOutputTokens: 1024 },
      })
    )) as unknown as AsyncIterable<StreamChunk>;
  } catch (err) {
    console.error("[mentor] stream connect failed", err);
    return geminiErrorPlainResponse(err, "mentor");
  }

  const encoder = new TextEncoder();
  const out = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const text = extractText(chunk);
          if (text) controller.enqueue(encoder.encode(text));
        }
        controller.close();
      } catch (err) {
        console.error("[mentor] mid-stream failure", err);
        const kind = classifyGeminiError(err);
        controller.enqueue(
          encoder.encode(
            kind === "quota_exceeded"
              ? "\n\n[Daily AI quota reached. Try again later.]"
              : "\n\n[Connection interrupted.]"
          )
        );
        controller.close();
      }
    },
  });

  return new Response(out, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
