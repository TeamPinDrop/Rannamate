/**
 * Server-only text-to-speech for Cooking Mate ("Mate speaks in my voice").
 * Providers (first configured wins):
 *   Inworld     — INWORLD_API_KEY (the "Basic (Base64)" value from Inworld Portal → API Keys),
 *                 INWORLD_VOICE_ID (your cloned voice's ID; defaults to the built-in "Sarah"),
 *                 INWORLD_MODEL (optional, default inworld-tts-2), INWORLD_SPEAKING_RATE (optional, default 1)
 *   ElevenLabs  — ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID, ELEVENLABS_MODEL (optional)
 */
export type TtsResult = { ok: true; audio: ArrayBuffer; provider: string; model: string } | { ok: false; error: string; status: number };

export function ttsProvider(): "inworld" | "elevenlabs" | null {
  if (process.env.INWORLD_API_KEY?.trim()) return "inworld";
  if (process.env.ELEVENLABS_API_KEY?.trim() && process.env.ELEVENLABS_VOICE_ID?.trim()) return "elevenlabs";
  return null;
}

const INWORLD_MODELS = ["inworld-tts-2", "inworld-tts-2-flash"];
const ELEVEN_MODELS = ["eleven_flash_v2_5", "eleven_multilingual_v2"];

/** Mild → steady, Masala → balanced, Extra Chatpata → expressive (inworld-tts-2 delivery presets). */
const DELIVERY: Record<string, string> = { mild: "STABLE", masala: "BALANCED", chatpata: "CREATIVE" };

async function inworld(text: string, persona: string): Promise<TtsResult> {
  const raw = process.env.INWORLD_API_KEY!.trim().replace(/^Basic\s+/i, "").replace(/^["']|["']$/g, "");
  const voiceId = process.env.INWORLD_VOICE_ID?.trim() || "Sarah";
  const models = process.env.INWORLD_MODEL ? [process.env.INWORLD_MODEL, ...INWORLD_MODELS] : INWORLD_MODELS;
  let last: TtsResult = { ok: false, error: "tts_error", status: 502 };
  for (const modelId of models) {
    try {
      const res = await fetch("https://api.inworld.ai/tts/v1/voice", {
        method: "POST",
        signal: AbortSignal.timeout(20_000),
        headers: { Authorization: `Basic ${raw}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          text: persona === "chatpata" && modelId.startsWith("inworld-tts-2") ? `[happy] ${text}` : text,
          voiceId,
          modelId,
          audioConfig: { audioEncoding: "MP3", speakingRate: Number(process.env.INWORLD_SPEAKING_RATE) || 1 },
          ...(modelId.startsWith("inworld-tts-2") ? { deliveryMode: DELIVERY[persona] ?? "BALANCED", language: "AUTO" } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.audioContent) {
        const buf = Buffer.from(data.audioContent as string, "base64");
        return { ok: true, audio: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), provider: "inworld", model: modelId };
      }
      const msg = data?.error?.message ?? data?.message ?? (res.ok ? "no audio returned" : `HTTP ${res.status}`);
      console.error(`[voice] inworld ${modelId} → HTTP ${res.status}: ${msg}`);
      last = { ok: false, error: msg, status: 502 };
      // only a model problem is worth retrying with another model
      if (!/model/i.test(msg) || res.status === 401 || res.status === 403) break;
    } catch (e) {
      const msg = e instanceof Error && e.name === "TimeoutError" ? "Inworld took too long" : "Can't reach Inworld";
      console.error(`[voice] inworld ${modelId}: ${msg}`);
      return { ok: false, error: msg, status: 502 };
    }
  }
  return last;
}

async function elevenlabs(text: string, persona: string): Promise<TtsResult> {
  const key = process.env.ELEVENLABS_API_KEY!.trim();
  const voice = process.env.ELEVENLABS_VOICE_ID!.trim();
  const style = persona === "chatpata" ? 0.6 : persona === "mild" ? 0.1 : 0.35;
  const models = process.env.ELEVENLABS_MODEL ? [process.env.ELEVENLABS_MODEL, ...ELEVEN_MODELS] : ELEVEN_MODELS;
  let last: TtsResult = { ok: false, error: "tts_error", status: 502 };
  for (const model_id of models) {
    try {
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_128`, {
        method: "POST",
        signal: AbortSignal.timeout(20_000),
        headers: { "Content-Type": "application/json", "xi-api-key": key, Accept: "audio/mpeg" },
        body: JSON.stringify({ text, model_id, voice_settings: { stability: 0.45, similarity_boost: 0.85, style, use_speaker_boost: true } }),
      });
      if (res.ok) return { ok: true, audio: await res.arrayBuffer(), provider: "elevenlabs", model: model_id };
      const data = await res.json().catch(() => ({}));
      const msg = data?.detail?.message ?? (typeof data?.detail === "string" ? data.detail : `HTTP ${res.status}`);
      console.error(`[voice] elevenlabs ${model_id} → HTTP ${res.status}: ${msg}`);
      last = { ok: false, error: msg, status: 502 };
      if ([401, 402, 429].includes(res.status)) break;
    } catch (e) {
      return { ok: false, error: e instanceof Error && e.name === "TimeoutError" ? "ElevenLabs took too long" : "Can't reach ElevenLabs", status: 502 };
    }
  }
  return last;
}

export async function synthesize(text: string, persona = "masala"): Promise<TtsResult> {
  const p = ttsProvider();
  if (!p) return { ok: false, error: "voice_not_configured", status: 501 };
  return p === "inworld" ? inworld(text, persona) : elevenlabs(text, persona);
}

/**
 * Streaming synthesis: returns an MP3 byte stream that starts as soon as the
 * provider sends its first chunk, so playback can begin almost immediately.
 */
export async function synthesizeStream(text: string, persona = "masala"): Promise<{ ok: true; stream: ReadableStream<Uint8Array> } | { ok: false; error: string; status: number }> {
  const p = ttsProvider();
  if (!p) return { ok: false, error: "voice_not_configured", status: 501 };

  if (p === "elevenlabs") {
    const key = process.env.ELEVENLABS_API_KEY!.trim();
    const voice = process.env.ELEVENLABS_VOICE_ID!.trim();
    const style = persona === "chatpata" ? 0.6 : persona === "mild" ? 0.1 : 0.35;
    try {
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}/stream?output_format=mp3_44100_128`, {
        method: "POST",
        signal: AbortSignal.timeout(30_000),
        headers: { "Content-Type": "application/json", "xi-api-key": key, Accept: "audio/mpeg" },
        body: JSON.stringify({ text, model_id: process.env.ELEVENLABS_MODEL || ELEVEN_MODELS[0], voice_settings: { stability: 0.45, similarity_boost: 0.85, style, use_speaker_boost: true } }),
      });
      if (!res.ok || !res.body) {
        const d = await res.json().catch(() => ({}));
        return { ok: false, error: d?.detail?.message ?? `HTTP ${res.status}`, status: 502 };
      }
      return { ok: true, stream: res.body };
    } catch {
      return { ok: false, error: "Can't reach ElevenLabs", status: 502 };
    }
  }

  // Inworld HTTP streaming: NDJSON lines, each { result: { audioContent: <base64 mp3> } }
  const raw = process.env.INWORLD_API_KEY!.trim().replace(/^Basic\s+/i, "").replace(/^["']|["']$/g, "");
  const voiceId = process.env.INWORLD_VOICE_ID?.trim() || "Sarah";
  const modelId = process.env.INWORLD_MODEL?.trim() || INWORLD_MODELS[0];
  const tts2 = modelId.startsWith("inworld-tts-2");
  let res: Response;
  try {
    res = await fetch("https://api.inworld.ai/tts/v1/voice:stream", {
      method: "POST",
      signal: AbortSignal.timeout(30_000),
      headers: { Authorization: `Basic ${raw}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        text: persona === "chatpata" && tts2 ? `[happy] ${text}` : text,
        voice_id: voiceId,
        model_id: modelId,
        audio_config: { audio_encoding: "MP3", speaking_rate: Number(process.env.INWORLD_SPEAKING_RATE) || 1 },
        ...(tts2 ? { delivery_mode: DELIVERY[persona] ?? "BALANCED", language: "AUTO" } : {}),
      }),
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error && e.name === "TimeoutError" ? "Inworld took too long" : "Can't reach Inworld", status: 502 };
  }
  if (!res.ok || !res.body) {
    const d = await res.json().catch(() => ({}));
    const msg = d?.error?.message ?? d?.message ?? `HTTP ${res.status}`;
    console.error(`[voice] inworld stream → HTTP ${res.status}: ${msg}`);
    return { ok: false, error: msg, status: 502 };
  }

  const upstream = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  /** returns how many audio chunks were emitted for this line */
  const emit = (line: string, ctrl: ReadableStreamDefaultController<Uint8Array>) => {
    const t = line.trim();
    if (!t) return 0;
    try {
      const obj = JSON.parse(t);
      const b64 = obj?.result?.audioContent;
      if (b64) { ctrl.enqueue(new Uint8Array(Buffer.from(b64, "base64"))); return 1; }
      if (obj?.error) console.error("[voice] inworld stream error:", obj.error?.message ?? obj.error);
    } catch { /* non-JSON line */ }
    return 0;
  };
  const stream = new ReadableStream<Uint8Array>({
    // keep reading until at least one audio chunk is out (or the upstream ends) —
    // a pull that enqueues nothing would stall the stream forever
    async pull(ctrl) {
      for (;;) {
        const { value, done } = await upstream.read();
        if (done) {
          emit(buffer, ctrl);
          ctrl.close();
          return;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        let sent = 0;
        for (const l of lines) sent += emit(l, ctrl);
        if (sent) return;
      }
    },
    cancel() { upstream.cancel().catch(() => {}); },
  });
  return { ok: true, stream };
}
