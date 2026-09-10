export const LLM_TIMEOUT_MS = 90000;

/** Proven fetch client for the OpenAI-compatible endpoint (Gemini free tier OK). */
export async function callLLM(
  system: string,
  user: string,
  opts: { maxTokens?: number; temp?: number } = {}
): Promise<string> {
  const base = (process.env.LLM_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.LLM_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.LLM_MODEL || "gpt-4o-mini",
      temperature: opts.temp ?? 0.3,
      max_tokens: opts.maxTokens ?? 2000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`LLM API ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content) throw new Error("Empty LLM response");
  return content;
}
