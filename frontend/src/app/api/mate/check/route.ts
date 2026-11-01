import { NextResponse } from "next/server";
import { RECIPES } from "@/lib/data/recipes";
import { GEMINI_SCHEMA } from "@/lib/mate/ai-schema";
import { synthesize, ttsProvider } from "@/lib/tts-server";

/**
 * Diagnostics: open http://localhost:3000/api/mate/check in the browser.
 * Sends a tiny prompt to each Gemini model and reports status + timing.
 * Never returns the key itself.
 */
export const dynamic = "force-dynamic";

const MODELS = ["gemini-3.6-flash", "gemini-3.5-flash-lite", "gemini-flash-latest", "gemini-3.8-flash"];

async function fullTest(key: string, model: string, thinking: Record<string, unknown> | null) {
  const catalog = RECIPES.map((r) => `${r.id} | ${r.name} | ${r.cuisine}`).join("\n");
  const t0 = Date.now();
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      signal: AbortSignal.timeout(30_000),
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: `You are Mate, a cooking assistant. Catalog:\n${catalog}\nInvent a recipe in "created" when nothing fits.` }] },
        contents: [{ role: "user", parts: [{ text: "I have onions, cucumbers and puffed rice. Suggest something new." }] }],
        generationConfig: { maxOutputTokens: 4096, responseMimeType: "application/json", responseSchema: GEMINI_SCHEMA, ...(thinking ? { thinkingConfig: thinking } : {}) },
      }),
    });
    const data = await res.json().catch(() => ({}));
    const text = (data.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
    return { model, thinking, status: res.status, ms: Date.now() - t0, ...(res.ok ? { chars: text.length, usage: data.usageMetadata } : { error: data?.error?.message }) };
  } catch (e) {
    return { model, thinking, status: "no response", ms: Date.now() - t0, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function GET(req: Request) {
  const full = new URL(req.url).searchParams.get("full");
  if (new URL(req.url).searchParams.get("stream")) {
    const raw = (process.env.INWORLD_API_KEY ?? "").trim().replace(/^Basic\s+/i, "");
    const camel = new URL(req.url).searchParams.get("camel") === "1";
    const t0 = Date.now();
    const tl: string[] = [];
    const ctl = new AbortController();
    const kill = setTimeout(() => ctl.abort(), 25_000);
    try {
      const body = camel
        ? { text: "Hello! I am Mate. Let's cook something tasty today.", voiceId: process.env.INWORLD_VOICE_ID?.trim() || "Sarah", modelId: process.env.INWORLD_MODEL?.trim() || "inworld-tts-2", audioConfig: { audioEncoding: "MP3" } }
        : {
            text: new URL(req.url).searchParams.get("text") || "Hello! I am Mate. Let's cook something tasty today.",
            voice_id: process.env.INWORLD_VOICE_ID?.trim() || "Sarah",
            model_id: process.env.INWORLD_MODEL?.trim() || "inworld-tts-2",
            audio_config: { audio_encoding: "MP3", ...(new URL(req.url).searchParams.get("rate") ? { speaking_rate: 1 } : {}) },
            ...(new URL(req.url).searchParams.get("lang") ? { language: new URL(req.url).searchParams.get("lang") } : {}),
            ...(new URL(req.url).searchParams.get("delivery") ? { delivery_mode: new URL(req.url).searchParams.get("delivery") } : {}),
          };
      const res = await fetch("https://api.inworld.ai/tts/v1/voice:stream", { method: "POST", signal: ctl.signal, headers: { Authorization: `Basic ${raw}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
      tl.push(`${Date.now() - t0}ms headers HTTP ${res.status} ${res.headers.get("content-type")}`);
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let n = 0, bytes = 0, sample = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        n++; bytes += value.length;
        if (n === 1) { tl.push(`${Date.now() - t0}ms first chunk ${value.length}b`); sample = dec.decode(value).slice(0, 160); }
      }
      tl.push(`${Date.now() - t0}ms end, chunks=${n}, bytes=${bytes}`);
      return NextResponse.json({ ok: true, timeline: tl, sample: sample.replace(/"audioContent":"[^"]{20}[^"]*"/, '"audioContent":"<base64…>"') });
    } catch (e) {
      tl.push(`${Date.now() - t0}ms ${e instanceof Error ? e.name + ": " + e.message : String(e)}`);
      return NextResponse.json({ ok: false, timeline: tl });
    } finally { clearTimeout(kill); }
  }
  if (new URL(req.url).searchParams.get("voice")) {
    const provider = ttsProvider();
    if (!provider) return NextResponse.json({ ok: false, problem: "No voice key loaded.", fix: "Add INWORLD_API_KEY (and INWORLD_VOICE_ID) to frontend/.env.local, then restart npm run dev." });
    const t0 = Date.now();
    const r = await synthesize("Hi! I'm Mate. Let's cook something amazing.", new URL(req.url).searchParams.get("persona") ?? "masala");
    return NextResponse.json(r.ok
      ? { ok: true, provider: r.provider, model: r.model, ms: Date.now() - t0, audioBytes: r.audio.byteLength, voiceId: provider === "inworld" ? process.env.INWORLD_VOICE_ID?.trim() || "Sarah (default — set INWORLD_VOICE_ID for your own voice)" : "set" }
      : { ok: false, provider, ms: Date.now() - t0, error: r.error });
  }
  if (full) {
    const key = process.env.GEMINI_API_KEY?.trim();
    if (!key) return NextResponse.json({ ok: false, problem: "no key" });
    const model = new URL(req.url).searchParams.get("model") || "gemini-3.6-flash";
    const out = [];
    for (const t of [null, { thinkingLevel: "low" }, { thinkingLevel: "minimal" }, { thinkingBudget: 0 }]) out.push(await fullTest(key, model, t));
    return NextResponse.json(out);
  }
  return quick();
}

async function quick() {
  const key = process.env.GEMINI_API_KEY?.trim();
  const claude = !!process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) {
    return NextResponse.json({
      ok: false,
      problem: "GEMINI_API_KEY is not loaded.",
      fix: "Put GEMINI_API_KEY=... in frontend/.env.local (no quotes/spaces), save, then stop and restart `npm run dev`.",
      anthropicKeyLoaded: claude,
    });
  }
  const format = key.startsWith("AQ.") ? "AQ. (new Google auth key)" : key.startsWith("AIza") ? "AIza (standard key)" : "unrecognised — check you copied the whole key";
  const models = process.env.GEMINI_MODEL ? [process.env.GEMINI_MODEL, ...MODELS] : MODELS;
  const results: Record<string, unknown>[] = [];
  for (const model of models) {
    const t0 = Date.now();
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        signal: AbortSignal.timeout(20_000),
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "Reply with exactly: Mate is ready" }] }] }),
      });
      const data = await res.json().catch(() => ({}));
      const sample = (data.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("").slice(0, 80);
      results.push({ model, status: res.status, ms: Date.now() - t0, ...(res.ok ? { sample } : { error: data?.error?.message ?? "unknown error" }) });
      if (res.ok) break; // first working model is the one Mate will use
    } catch (e) {
      results.push({ model, status: "no response", ms: Date.now() - t0, error: e instanceof Error && e.name === "TimeoutError" ? "timed out after 20 s" : String(e instanceof Error ? (e.cause ?? e.message) : e) });
    }
  }
  const ok = results.some((r) => r.status === 200);
  return NextResponse.json({ ok, keyFormat: format, keyLength: key.length, results });
}
