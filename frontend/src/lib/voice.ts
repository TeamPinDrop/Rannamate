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

export function useSpeechSynthesis() {
  const [supported, setSupported] = useState(false);
  const [muted, setMuted] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => setSupported(typeof window !== "undefined" && "speechSynthesis" in window), []);

  const speak = useCallback((raw: string, opts: { rate?: number; pitch?: number } = {}) => {
    if (!supported || muted) return;
    const text = raw
      .replace(/\[\[[^\]]*\]\]/g, "")
      .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, "")
      .replace(/\s{2,}/g, " ")
      .trim();
    if (!text) return;
    window.speechSynthesis.cancel();
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
  }, [supported, muted]);

  const cancel = useCallback(() => { if (supported) window.speechSynthesis.cancel(); setSpeaking(false); }, [supported]);
  const pause = useCallback(() => { if (supported) window.speechSynthesis.pause(); }, [supported]);
  const resume = useCallback(() => { if (supported) window.speechSynthesis.resume(); }, [supported]);

  const toggleMute = useCallback(() => {
    setMuted((m) => { if (!m && supported) window.speechSynthesis.cancel(); return !m; });
  }, [supported]);

  return { supported, muted, speaking, speak, cancel, pause, resume, toggleMute };
}
