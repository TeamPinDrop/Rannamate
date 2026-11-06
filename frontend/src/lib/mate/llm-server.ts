/**
 * Server-only calls to the generative model behind Cooking Mate (Gemini preferred, Claude as
 * an alternative). Shared by /api/mate and /api/mate/chill. Keys come from .env.local and are
 * never sent to the browser.
 */

// Fast, reliable model first; others are fallbacks. A model that is slow or unreachable is skipped.
const GEMINI_MODELS = ["gemini-3.6-flash", "gemini-3.5-flash-lite", "gemini-flash-latest", "gemini-3.8-flash"];
const FIRST_TRY_MS = 18_000;
/** Models that told us their quota is used up are skipped until this time (ms). */
const cooledUntil = new Map<string, number>();
const NEXT_TRY_MS = 10_000;
/** Whole request must finish well before the browser gives up (35 s). */
const BUDGET_MS = 28_000;

export type LlmHistory = { who: "user" | "mate"; text: string }[];

export function llmProvider(): { kind: "gemini" | "claude"; key: string } | null {
  const gemini = process.env.GEMINI_API_KEY?.trim();
  if (gemini) return { kind: "gemini", key: gemini };
  const anthropic = process.env.ANTHROPIC_API_KEY?.trim();
  if (anthropic) return { kind: "claude", key: anthropic };
  return null;
}

export async function callGemini(
  key: string,
  system: string,
  history: LlmHistory,
  opts: { schema: object; temperature?: number; extra?: string; maxTokens?: number; budgetMs?: number },
) {
  const models = process.env.GEMINI_MODEL ? [process.env.GEMINI_MODEL, ...GEMINI_MODELS] : GEMINI_MODELS;
  const deadline = Date.now() + (opts.budgetMs ?? BUDGET_MS);
  const contents = history.map((m) => ({ role: m.who === "user" ? "user" : "model", parts: [{ text: m.text }] }));
  if (opts.extra) contents.push({ role: "user", parts: [{ text: opts.extra }] });
  let lastErr = "ai_error";
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const usable = models.filter((m) => (cooledUntil.get(m) ?? 0) < Date.now());
  for (const [i, model] of (usable.length ? usable : models).entries()) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const left = Math.min(deadline - Date.now(), i === 0 && attempt === 0 ? FIRST_TRY_MS : NEXT_TRY_MS);
      if (left < 3000) throw new Error(lastErr === "ai_error" ? "Gemini took too long to answer" : lastErr);
      const t0 = Date.now();
      let res: Response;
      try {
        res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: "POST",
          signal: AbortSignal.timeout(left),
          headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents,
            generationConfig: {
              temperature: opts.temperature ?? 0.8,
              maxOutputTokens: opts.maxTokens ?? 4096,
              responseMimeType: "application/json",
              responseSchema: opts.schema,
              // Gemini 3.x "thinks" before answering; a low level keeps replies fast for a voice chat
              ...(model.startsWith("gemini-3") && attempt === 0 ? { thinkingConfig: { thinkingLevel: "low" } } : {}),
            },
          }),
        });
      } catch (e) {
        lastErr = e instanceof Error && e.name === "TimeoutError" ? "Gemini took too long to answer" : `Can't reach Gemini (${e instanceof Error ? e.message : "network error"})`;
        console.error(`[mate] ${model}: ${lastErr} — trying the next model`);
        break; // next model
      }
      const data = await res.json().catch(() => ({}));
      console.log(`[mate] ${model} → HTTP ${res.status} in ${Date.now() - t0} ms`);
      if (res.ok) {
        const text = (data.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
        if (text.trim()) return { text, model };
        lastErr = "Gemini returned an empty answer";
        break;
      }
      lastErr = data?.error?.message ?? `HTTP ${res.status}`;
      console.error(`[mate] ${model} error: ${lastErr}`);
      // a bad key won't work on any model — stop right away
      if ((res.status === 401 || res.status === 403 || res.status === 400) && !/not found|not supported|no longer available|model/i.test(lastErr)) throw new Error(lastErr);
      // daily/minute quota used up → skip this model for a while instead of retrying it on every message
      if (res.status === 429 && /quota|per day|limit/i.test(lastErr)) {
        const wait = /per ?day|PerDay|daily/i.test(lastErr) ? 60 * 60_000 : 60_000;
        cooledUntil.set(model, Date.now() + wait);
        console.log(`[mate] ${model} quota reached — skipping it for ${wait / 60_000} min`);
        break;
      }
      // overloaded / rate-limited → one quick retry on the same model, then move on
      if ((res.status === 503 || res.status === 429 || res.status === 500) && attempt === 0) { await sleep(1200); continue; }
      break;
    }
  }
  throw new Error(lastErr);
}

export async function callClaude(
  key: string,
  system: string,
  history: LlmHistory,
  opts: { jsonHint: string; extra?: string; maxTokens?: number; temperature?: number; budgetMs?: number },
) {
  const model = process.env.ANTHROPIC_MODEL || "claude-haiku-5-5";
  const msgs = history.map((m) => ({ role: m.who === "user" ? "user" : "assistant", content: m.text }));
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  if (opts.extra) msgs.push({ role: "user", content: opts.extra });
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    signal: AbortSignal.timeout(opts.budgetMs ?? BUDGET_MS),
    headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model,
      max_tokens: opts.maxTokens ?? 2048,
      ...(opts.temperature !== undefined ? { temperature: Math.min(1, opts.temperature) } : {}),
      system: `${system}\n\n${opts.jsonHint}`,
      messages: msgs,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message ?? `HTTP ${res.status}`);
  return { text: (data.content ?? []).map((c: { text?: string }) => c.text ?? "").join(""), model };
}

/** Pulls the first JSON object out of a model reply. */
export function extractJson(text: string): unknown {
  try {
    return JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
  } catch {
    return null;
  }
}
