/**
 * Sanitized error responses for Gemini-backed routes.
 *
 * Without this, route catch-blocks return raw SDK Error.message — which
 * is often the full Google API response JSON (RESOURCE_EXHAUSTED, billing
 * URLs, retry hints). Clients then render that JSON verbatim in the UI.
 *
 * Every Gemini route should funnel its catch through one of:
 *   - geminiErrorPlainResponse  (for text/streaming routes)
 *   - geminiErrorJsonResponse   (for JSON routes)
 *
 * Clients can rely on a stable, JSON-free `error` taxonomy:
 *   "quota_exceeded"     → 429, daily free-tier limit hit
 *   "<tag>_timeout"      → 504, our AbortController fired
 *   "<tag>_failed"       → 502, any other upstream failure
 */

export type GeminiErrorKind = "quota_exceeded" | "timeout" | "upstream";

export function classifyGeminiError(err: unknown): GeminiErrorKind {
  if (err instanceof Error && err.name === "AbortError") return "timeout";
  const raw = err instanceof Error ? err.message : "";
  if (raw.includes('"code":429') || /RESOURCE_EXHAUSTED/.test(raw)) {
    return "quota_exceeded";
  }
  return "upstream";
}

export function geminiErrorPlainResponse(
  err: unknown,
  failureTag: string
): Response {
  const kind = classifyGeminiError(err);
  if (kind === "quota_exceeded") {
    return new Response("quota_exceeded", { status: 429 });
  }
  if (kind === "timeout") {
    return new Response(`${failureTag}_timeout`, { status: 504 });
  }
  return new Response(`${failureTag}_failed`, { status: 502 });
}

export function geminiErrorJsonResponse(
  err: unknown,
  failureTag: string
): Response {
  const kind = classifyGeminiError(err);
  if (kind === "quota_exceeded") {
    return Response.json({ error: "quota_exceeded" }, { status: 429 });
  }
  if (kind === "timeout") {
    return Response.json({ error: `${failureTag}_timeout` }, { status: 504 });
  }
  return Response.json({ error: `${failureTag}_failed` }, { status: 502 });
}
