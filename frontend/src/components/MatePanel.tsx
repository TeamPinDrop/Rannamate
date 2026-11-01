"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Ear, Mic, MicOff, Pause, Play, Send, Volume2, VolumeX } from "lucide-react";
import { askMate, type MateReply } from "@/lib/api";
import type { MateAction } from "@/lib/mate-local";
import { useSpeechRecognition, useSpeechSynthesis } from "@/lib/voice";
import { useStore } from "@/lib/store";
import type { Recipe } from "@/lib/types";

interface Msg { who: "user" | "ai"; text: string; source?: MateReply["source"] }

const SUGGESTIONS = ["What's the next step?", "How much salt should I add?", "Can I make this less spicy?", "Can I make this without garlic?", "Start timer"];

export function MatePanel({
  recipe, step = 0, onAction, dark, className = "",
}: { recipe: Recipe | null; step?: number; onAction?: (a: MateAction) => void; dark?: boolean; className?: string }) {
  const profile = useStore((s) => s.profile);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [handsFree, setHandsFree] = useState(false);
  const [paused, setPaused] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const tts = useSpeechSynthesis();

  useEffect(() => {
    setMsgs([{ who: "ai", text: recipe ? `Hi! I'm with you for ${recipe.name}. Ask me anything, or say "next step".` : "Hi! Pick a recipe and I'll guide you through it." }]);
  }, [recipe]);

  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }); }, [msgs, busy]);

  const send = useCallback(async (raw: string) => {
    const q = raw.replace(/^(hey\s+)?rannamate[,!\s]*/i, "").trim();
    if (!q) return;
    setMsgs((m) => [...m, { who: "user", text: raw.trim() }]);
    setInput("");
    setBusy(true);
    const reply = await askMate(q, { recipe, stepIndex: step, restrictions: [...profile.allergies.map((a) => `allergy:${a}`), ...profile.diets] });
    setBusy(false);
    setMsgs((m) => [...m, { who: "ai", text: reply.text, source: reply.source }]);
    if (reply.action) onAction?.(reply.action);
    tts.speak(reply.text);
  }, [recipe, step, profile, onAction, tts]);

  const stt = useSpeechRecognition(send);

  // hands-free: keep listening whenever we're idle
  useEffect(() => {
    if (handsFree && stt.supported && !stt.listening && !busy && !tts.speaking && !stt.error) {
      const t = setTimeout(stt.start, 500);
      return () => clearTimeout(t);
    }
  }, [handsFree, stt, busy, tts.speaking]);

  const surface = dark ? "glass-dark text-cream-50" : "glass-strong text-forest";
  const bubbleAi = dark ? "bg-cream/15 text-cream-50" : "bg-white/60 text-forest";
  const bubbleUser = dark ? "bg-cream text-burgundy" : "bg-forest text-cream-50";

  return (
    <div className={`${surface} flex flex-col rounded-[2rem] p-4 ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-burgundy text-base">
            🧑‍🍳{(stt.listening || tts.speaking) && <span className="absolute inset-0 rounded-full border-2 border-burgundy animate-pulse-ring" />}
          </span>
          <div className="leading-tight">
            <p className="text-sm font-bold">Cooking Mate</p>
            <p className="text-[11px] opacity-70">{stt.listening ? "Listening…" : tts.speaking ? "Speaking…" : recipe ? `Step ${step + 1} of ${recipe.steps.length}` : "Ready"}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {tts.supported && tts.speaking && (
            <button onClick={() => { if (paused) { tts.resume(); setPaused(false); } else { tts.pause(); setPaused(true); } }} className="rounded-full p-2 hover:bg-white/20" aria-label={paused ? "Resume voice" : "Pause voice"}>
              {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            </button>
          )}
          {tts.supported && (
            <button onClick={tts.toggleMute} className="rounded-full p-2 hover:bg-white/20" aria-label={tts.muted ? "Unmute voice replies" : "Mute voice replies"} aria-pressed={tts.muted}>
              {tts.muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
          )}
          {stt.supported && (
            <button onClick={() => { setHandsFree((h) => !h); if (handsFree) stt.stop(); }} className={`rounded-full px-2.5 py-1.5 text-[11px] font-bold ${handsFree ? "bg-burgundy text-cream-50" : "hover:bg-white/20"}`} aria-pressed={handsFree} title="Keep listening between questions">
              <Ear className="mr-1 inline h-3.5 w-3.5" />Hands-free
            </button>
          )}
        </div>
      </div>

      <div ref={listRef} className="no-scrollbar min-h-[200px] flex-1 space-y-2.5 overflow-y-auto pr-1" aria-live="polite">
        <AnimatePresence initial={false}>
          {msgs.map((m, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} className={`max-w-[88%] rounded-3xl px-4 py-2.5 text-[14px] leading-relaxed ${m.who === "user" ? `ml-auto rounded-br-md ${bubbleUser}` : `rounded-bl-md ${bubbleAi}`}`}>
              {m.text}
              {m.source === "offline" && <span className="mt-1 block text-[10px] font-semibold uppercase tracking-wider opacity-60">Offline helper · AI service not connected</span>}
            </motion.div>
          ))}
        </AnimatePresence>
        {busy && (
          <div className={`flex w-16 gap-1 rounded-3xl px-4 py-3 ${bubbleAi}`}>
            {[0, 1, 2].map((d) => <motion.span key={d} className="h-2 w-2 rounded-full bg-current opacity-50" animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.8, delay: d * 0.15 }} />)}
          </div>
        )}
        {stt.interim && <p className="ml-auto max-w-[88%] rounded-3xl px-4 py-2 text-right text-sm italic opacity-70">{stt.interim}…</p>}
      </div>

      <div className="no-scrollbar mt-3 flex gap-1.5 overflow-x-auto pb-1">
        {SUGGESTIONS.map((s) => (
          <button key={s} onClick={() => send(s)} disabled={busy} className={`shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold ${dark ? "bg-cream/10 hover:bg-cream/20" : "bg-white/40 hover:bg-white/70"}`}>{s}</button>
        ))}
      </div>

      {stt.error && <p className="mt-2 rounded-xl bg-burgundy/15 px-3 py-2 text-xs">{stt.error}</p>}
      {!stt.supported && <p className="mt-2 text-[11px] opacity-70">Voice input isn&apos;t available in this browser — typing works everywhere.</p>}

      <form onSubmit={(e) => { e.preventDefault(); send(input); }} className={`mt-3 flex items-center gap-2 rounded-full p-1.5 pl-4 ${dark ? "bg-cream/15" : "bg-white/60"}`}>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask RANNAMATE anything…" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:opacity-60" aria-label="Message Cooking Mate" />
        {stt.supported && (
          <button type="button" onClick={stt.listening ? stt.stop : stt.start} className={`relative flex h-10 w-10 items-center justify-center rounded-full ${stt.listening ? "bg-burgundy text-cream-50" : dark ? "bg-cream/20" : "bg-white/80 text-forest"}`} aria-label={stt.listening ? "Stop listening" : "Speak your question"}>
            {stt.listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            {stt.listening && <span className="absolute inset-0 rounded-full border-2 border-burgundy animate-pulse-ring" />}
          </button>
        )}
        <button type="submit" disabled={!input.trim() || busy} className="flex h-10 w-10 items-center justify-center rounded-full bg-burgundy text-cream-50 disabled:opacity-40" aria-label="Send">
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
