import { NextResponse } from "next/server";
import { synthesize, synthesizeStream, ttsProvider } from "@/lib/tts-server";

/**
 * Cooking Mate speaks in the owner's voice (Inworld or ElevenLabs). Keys stay on the server.
 *   GET  /api/mate/speak                      → { enabled, provider }
 *   GET  /api/mate/speak?text=…&persona=…     → streamed MP3 (used by the <audio> element — starts playing at once)
 *   POST /api/mate/speak { text, persona }    → full MP3 (fallback / diagnostics)
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const text = (url.searchParams.get("text") ?? "").slice(0, 700).trim();
  if (!text) return NextResponse.json({ enabled: !!ttsProvider(), provider: ttsProvider(), streaming: true });
  const r = await synthesizeStream(text, url.searchParams.get("persona") ?? "masala");
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return new Response(r.stream, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store", "X-Accel-Buffering": "no" } });
}

export async function POST(req: Request) {
  let text = "";
  let persona = "masala";
  try {
    const b = await req.json();
    text = String(b.text ?? "").slice(0, 700).trim();
    persona = String(b.persona ?? "masala");
  } catch { /* ignore */ }
  if (!text) return NextResponse.json({ error: "empty" }, { status: 400 });
  const r = await synthesize(text, persona);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return new Response(r.audio, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store", "X-Voice": `${r.provider}/${r.model}` } });
}
