"use client";
import { useCallback, useEffect, useRef, useState } from "react";

/* Minimal typings for the Web Speech API (not in lib.dom for all TS versions). */
type SR = {
  lang: string; continuous: boolean; interimResults: boolean;
  start(): void; stop(): void; abort(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function getRecognition(): (new () => SR) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useSpeechRecognition(onFinal: (text: string) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<SR | null>(null);
  const cb = useRef(onFinal);
  cb.current = onFinal;

  useEffect(() => setSupported(!!getRecognition()), []);
  // release the microphone if the component using it goes away mid-sentence
  useEffect(() => () => { const r = ref.current; if (r) { r.onresult = null; r.onerror = null; r.onend = null; try { r.abort(); } catch { /* already stopped */ } } }, []);

  const start = useCallback(() => {
    const Ctor = getRecognition();
    if (!Ctor) { setError("Voice input isn't supported in this browser. Try Chrome or Edge, or type your question."); return; }
    setError(null);
    const r = new Ctor();
    r.lang = "en-IN";
    r.continuous = false;
    r.interimResults = true;
    r.onresult = (e) => {
      let text = "";
      let final = false;
      for (let i = 0; i < e.results.length; i++) {
        text += e.results[i][0].transcript;
        if (e.results[i].isFinal) final = true;
      }
      setInterim(text);
      if (final) { setInterim(""); cb.current(text.trim()); }
    };
    r.onerror = (e) => {
      setError(
        e.error === "not-allowed" || e.error === "service-not-allowed"
          ? "Microphone permission was denied. Allow it in your browser settings to talk to RANNAMATE."
          : e.error === "no-speech" ? "I didn't hear anything — try again." : `Voice error: ${e.error}`,
      );
      setListening(false);
    };
    r.onend = () => setListening(false);
    ref.current = r;
    try { r.start(); setListening(true); } catch { setListening(false); }
  }, []);

  const stop = useCallback(() => { ref.current?.stop(); setListening(false); }, []);

  return { supported, listening, interim, error, start, stop };
}

const clean = (raw: string) =>
  raw
    .replace(/\[\[[^\]]*\]\]/g, "")
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, "")
    .replace(/\s{2,}/g, " ")
    .trim();

/**
 * Speaks with the owner's cloned voice (ElevenLabs via /api/mate/speak) when it's
 * configured, and falls back to the browser's built-in voice otherwise.
 */
export function useSpeechSynthesis() {
  const [supported, setSupported] = useState(false);
  const [muted, setMuted] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [cloudVoice, setCloudVoice] = useState(false); // configured on the server
  const [useCloud, setUseCloud] = useState(true); // user preference
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && ("speechSynthesis" in window || "Audio" in window));
    try { setUseCloud(localStorage.getItem("rannamate:voice") !== "browser"); } catch { /* ignore */ }
    fetch("/api/mate/speak").then((r) => r.json()).then((d) => setCloudVoice(!!d.enabled)).catch(() => setCloudVoice(false));
  }, []);

  const stopAll = useCallback(() => {
    seq.current++;
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ""; audioRef.current = null; }
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

  const browserSpeak = useCallback((text: string, opts: { rate?: number; pitch?: number }) => {
    if (!("speechSynthesis" in window)) { setSpeaking(false); return; }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-IN";
    u.rate = opts.rate ?? 1;
    u.pitch = opts.pitch ?? 1;
    const voices = window.speechSynthesis.getVoices();
    const v = voices.find((x) => /en-(IN|GB)/.test(x.lang)) ?? voices.find((x) => x.lang.startsWith("en"));
    if (v) u.voice = v;
    u.onstart = () => setSpeaking(true);
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(u);
  }, []);

  /**
   * Speaks `raw`. Resolves as soon as audio is actually audible (or immediately when
   * falling back / muted), so the UI can reveal text and animate the face in sync.
   */
  const speak = useCallback((raw: string, opts: { rate?: number; pitch?: number; persona?: string } = {}): Promise<void> => {
    if (!supported || muted) return Promise.resolve();
    const text = clean(raw);
    if (!text) return Promise.resolve();
    stopAll();
    const my = seq.current;

    if (cloudVoice && useCloud) {
      return new Promise<void>((resolve) => {
        let settled = false;
        const settle = () => { if (!settled) { settled = true; resolve(); } };
        const fallback = (why: string) => {
          if (my !== seq.current) return settle();
          if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ""; audioRef.current = null; }
          setVoiceError(why);
          browserSpeak(text, opts);
          settle();
        };
        // Streamed MP3: the <audio> element starts playing while the rest is still being generated
        // unique &n= so the browser never waits on (or reuses) an earlier request for the same sentence
        const a = new Audio(`/api/mate/speak?persona=${encodeURIComponent(opts.persona ?? "masala")}&n=${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}&text=${encodeURIComponent(text)}`);
        audioRef.current = a;
        a.preload = "auto";
        a.playbackRate = Math.min(1.15, Math.max(0.9, opts.rate ?? 1));
        const slow = setTimeout(() => { if (!settled) fallback("voice took too long to start"); }, 9000);
        a.onplaying = () => { if (my !== seq.current) return; clearTimeout(slow); setSpeaking(true); setVoiceError(null); settle(); };
        a.onended = () => { if (my === seq.current) setSpeaking(false); };
        a.onerror = () => { clearTimeout(slow); if (my === seq.current) setSpeaking(false); if (!settled) fallback("voice service unavailable"); };
        a.play().catch((e: unknown) => {
          clearTimeout(slow);
          // Autoplay blocked (no recent click) or stream failed — use the browser voice instead
          fallback(e instanceof DOMException && e.name === "NotAllowedError" ? "browser blocked autoplay — click anywhere once" : "voice service unavailable");
        });
      });
    }
    browserSpeak(text, opts);
    return Promise.resolve();
  }, [supported, muted, cloudVoice, useCloud, stopAll, browserSpeak]);

  const cancel = useCallback(() => { stopAll(); setSpeaking(false); }, [stopAll]);
  // stop this instance's audio when its component unmounts
  useEffect(() => () => { seq.current++; if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ""; audioRef.current = null; } }, []);
  const pause = useCallback(() => { audioRef.current?.pause(); if ("speechSynthesis" in window) window.speechSynthesis.pause(); }, []);
  const resume = useCallback(() => { audioRef.current?.play().catch(() => {}); if ("speechSynthesis" in window) window.speechSynthesis.resume(); }, []);

  const toggleMute = useCallback(() => {
    setMuted((m) => { if (!m) { stopAll(); setSpeaking(false); } return !m; });
  }, [stopAll]);

  const setVoiceSource = useCallback((cloud: boolean) => {
    setUseCloud(cloud);
    try { localStorage.setItem("rannamate:voice", cloud ? "cloud" : "browser"); } catch { /* ignore */ }
  }, []);

  return { supported, muted, speaking, speak, cancel, pause, resume, toggleMute, cloudVoice, useCloud, setVoiceSource, voiceError };
}
