"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { BookOpen, Brain, ChevronDown, ChevronLeft, ChevronUp, Laugh, Lightbulb, MessagesSquare, Mic, MicOff, Music, Pause, Play, Puzzle, Scale, Search, Timer, Trophy, Volume2, VolumeX, X } from "lucide-react";
import { ChillOrb, Waveform, type OrbState } from "./ChillOrb";
import { ChatGame, FactsGame, GuessGame, JokesGame, RiddleGame, SongGame, StoryGame, TriviaGame, WyrGame, type ChatMsg, type ChillApi, type VoiceHandler } from "./activities";
import { ACHIEVEMENTS, ACTIVITIES, ACTIVITY_BY_ID, canStart, fmtLeft, recommended, voiceCommand, WRAP_UP_SECONDS, type StepSafety } from "@/lib/chill/engine";
import { endSession, getChill, markSource, record, recentFor, remember, setShowPoints, startActivity, startSession, useChill, type ChillEvent } from "@/lib/chill/store";
import type { ActivityId, ChillContext } from "@/lib/chill/types";
import { useSpeechRecognition, useSpeechSynthesis } from "@/lib/voice";
import { VOICE_STYLE } from "@/lib/mate/persona";
import type { Lang, Persona } from "@/lib/mate/types";
import { ingredient } from "@/lib/data/ingredients";
import { useStore } from "@/lib/store";
import type { Recipe } from "@/lib/types";

const ICONS: Record<ActivityId, typeof Brain> = { trivia: Brain, guess: Search, wyr: Scale, jokes: Laugh, facts: Lightbulb, riddles: Puzzle, chat: MessagesSquare, story: BookOpen, song: Music };
const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
const SPOKEN_ACTIVITY: [RegExp, ActivityId][] = [
  [/trivia|quiz|question/, "trivia"], [/guess|ingredient/, "guess"], [/would you rather|rather/, "wyr"], [/joke|funny/, "jokes"],
  [/fact/, "facts"], [/riddle/, "riddles"], [/chat|talk|conversation/, "chat"], [/story|stories/, "story"], [/sing|song|rap|jingle/, "song"],
];

interface Props {
  open: boolean;
  onClose: () => void;
  onAskMate: () => void;
  recipe: Recipe;
  stepIndex: number;
  stepText: string;
  nextStepText: string | null;
  remaining: number;
  running: boolean;
  timerDone: boolean;
  safety: StepSafety;
}

/**
 * Cook & Chill — lives only inside Immersive Cooking Mode. It reads the cooking timer but can
 * never change it, and it stops talking the moment the timer, a safety step or the user says so.
 */
export function CookAndChill({ open, onClose, onAskMate, recipe, stepIndex, stepText, nextStepText, remaining, running, timerDone, safety }: Props) {
  const pantry = useStore((s) => s.pantry);
  const profile = useStore((s) => s.profile);
  const showPoints = useChill((s) => s.prefs.showPoints);
  const stats = useChill((s) => s.stats);
  const unlocked = useChill((s) => s.achievements);

  const [persona, setPersona] = useState<Persona>("masala");
  const [lang, setLang] = useState<Lang>("en");
  const [aiLive, setAiLive] = useState<boolean | null>(null);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [activity, setActivity] = useState<ActivityId | null>(null);
  const [paused, setPaused] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [trophies, setTrophies] = useState(false);
  const [thinking, setThinking] = useState(0);
  const [flash, setFlash] = useState<OrbState | null>(null);
  const [toasts, setToasts] = useState<{ id: number; text: string }[]>([]);
  const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([]);
  const sessionId = useRef<string | null>(null);
  const voice = useRef<VoiceHandler | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapSaid = useRef<number | null>(null);

  const tts = useSpeechSynthesis();
  const ttsRef = useRef(tts);
  ttsRef.current = tts;

  // ---- setup ----
  useEffect(() => {
    try {
      const p = JSON.parse(localStorage.getItem("rannamate:mate-prefs") ?? "{}") as { persona?: Persona; lang?: Lang };
      if (p.persona) setPersona(p.persona);
      if (p.lang) setLang(p.lang);
    } catch { /* defaults */ }
    const ctrl = new AbortController();
    fetch("/api/mate/chill", { signal: ctrl.signal }).then((r) => r.json()).then((d) => setAiLive(!!d.live)).catch(() => setAiLive(false));
    return () => {
      ctrl.abort();
      if (flashTimer.current) clearTimeout(flashTimer.current);
      if (sessionId.current) endSession(sessionId.current, "left");
    };
  }, []);

  useEffect(() => { if (open && !sessionId.current) sessionId.current = startSession(recipe.id); }, [open, recipe.id]);

  // ---- priority: timer, safety and closing always silence entertainment ----
  // Only silence our own voice/mic — never cut off Cooking Mate or the timer alert.
  const halt = useCallback(() => {
    if (wasOpen.current || ttsRef.current.speaking) ttsRef.current.cancel();
    if (sttRef.current?.listening) sttRef.current.stop();
    setThinking(0);
  }, []);
  const wasOpen = useRef(open);
  useEffect(() => {
    if (wasOpen.current && !open) halt();
    if (!wasOpen.current && open) { setPaused(false); setMinimized(false); }
    wasOpen.current = open;
  }, [open, halt]);
  useEffect(() => { if (timerDone || safety.level !== "passive") halt(); }, [timerDone, safety.level, halt]);

  const wrap = remaining < WRAP_UP_SECONDS;
  const canStartNew = !timerDone && !wrap && safety.level === "passive";

  // gentle heads-up when the timer is nearly done
  useEffect(() => {
    if (!open || paused || !running || !wrap || timerDone || wrapSaid.current === stepIndex || !activity) return;
    wrapSaid.current = stepIndex;
    ttsRef.current.speak(`Almost time! Let's wrap up.${nextStepText ? " Next, we'll " + nextStepText.charAt(0).toLowerCase() + nextStepText.slice(1, 120) : ""}`, { ...VOICE_STYLE[persona], persona });
  }, [open, paused, running, wrap, timerDone, stepIndex, activity, nextStepText, persona]);

  // ---- context for the AI ----
  const ingredientIds = useMemo(() => recipe.ingredients.map((i) => i.ingredientId).filter((id) => !ingredient(id).staple), [recipe]);
  const ctx: ChillContext = useMemo(() => ({
    recipeName: recipe.name,
    cuisine: recipe.cuisine,
    stepText,
    nextStepText,
    remainingSec: remaining,
    ingredients: ingredientIds.map((id) => ingredient(id).name),
    pantry: pantry.map((p) => ingredient(p.ingredientId).name),
    persona,
    lang,
    allergies: profile.allergies,
  }), [recipe, stepText, nextStepText, remaining, ingredientIds, pantry, persona, lang, profile.allergies]);
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;
  const activityRef = useRef(activity);
  activityRef.current = activity;

  // ---- voice ----
  const say = useCallback((text: string, opts: { rate?: number; pitch?: number } = {}) => {
    if (!wasOpen.current) return;
    void ttsRef.current.speak(text, { ...VOICE_STYLE[persona], ...opts, persona });
  }, [persona]);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  const choose = useCallback((id: ActivityId) => {
    ttsRef.current.cancel();
    setActivity(id);
    setTrophies(false);
    if (sessionId.current) startActivity(sessionId.current, id);
  }, []);

  const onHeard = useCallback((text: string) => {
    const cmd = voiceCommand(text);
    if (cmd === "stop") { onClose(); return; }
    if (cmd === "pause") { setPaused(true); ttsRef.current.cancel(); return; }
    if (pausedRef.current) { if (/^(resume|continue|play|go on)/i.test(text)) setPaused(false); return; }
    if (!activityRef.current) {
      const hit = SPOKEN_ACTIVITY.find(([re]) => re.test(text.toLowerCase()));
      if (hit) choose(hit[1]);
      return;
    }
    voice.current?.(text, cmd);
  }, [onClose, choose]);
  const stt = useSpeechRecognition(onHeard);
  const sttRef = useRef(stt);
  sttRef.current = stt;
  const toggleMic = useCallback(() => { if (sttRef.current.listening) sttRef.current.stop(); else { ttsRef.current.cancel(); sttRef.current.start(); } }, []);

  // ---- orb ----
  const orb = useCallback((s: OrbState) => {
    if (s === "thinking") setThinking((n) => n + 1);
    else if (s === "idle" || s === "talking") setThinking(0);
    if (s === "celebrate" || s === "oops") {
      setThinking(0);
      setFlash(s);
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setFlash(null), 1300);
    }
  }, []);
  const orbState: OrbState = paused ? "paused" : flash ?? (stt.listening ? "listening" : thinking ? "thinking" : tts.speaking ? "talking" : "idle");

  // ---- AI ----
  const fetchAi = useCallback(async <T,>(req: object): Promise<{ data: T; source: "ai" } | null> => {
    const sid = sessionId.current;
    if (!aiLive) { if (sid) markSource(sid, "library"); return null; }
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 22_000);
    try {
      const res = await fetch("/api/mate/chill", { method: "POST", signal: ctrl.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...req, ctx: ctxRef.current }) });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d?.data) { setAiNote(null); if (sid) markSource(sid, "ai"); return { data: d.data as T, source: "ai" }; }
      setAiNote(res.status === 422 ? "Mate's live answer didn't pass our checks" : "Live AI didn't answer");
    } catch {
      setAiNote("Couldn't reach live AI");
    } finally {
      clearTimeout(t);
    }
    if (sid) markSource(sid, "library");
    return null;
  }, [aiLive]);

  // ---- points ----
  const toastId = useRef(0);
  const pushToast = (text: string) => {
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-2), { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
  };
  const recordEv = useCallback((ev: ChillEvent) => {
    if (!activityRef.current) return;
    const r = record(sessionId.current, activityRef.current, ev);
    if (!getChill().prefs.showPoints) return;
    if (r.points > 2) pushToast(`+${r.points} points`);
    r.unlocked.forEach((a) => pushToast(`${a.emoji} ${a.title} unlocked!`));
  }, []);

  const openChat = useCallback((line: string) => {
    setChatMsgs((m) => [...m, { who: "mate", text: line }]);
    choose("chat");
  }, [choose]);

  const api: ChillApi = useMemo(() => ({
    ctx, ingredientIds, canStartNew, remaining,
    fetchAi: fetchAi as ChillApi["fetchAi"],
    say: (t, o) => { if (!pausedRef.current) say(t, o); },
    stopVoice: () => ttsRef.current.cancel(),
    speaking: tts.speaking,
    orb,
    record: recordEv,
    remember: (id) => { if (activityRef.current) remember(activityRef.current, id); },
    recent: () => (activityRef.current ? recentFor(activityRef.current) : []),
    voice,
    listening: stt.listening,
    toggleMic,
    micSupported: stt.supported,
    chat: { msgs: chatMsgs, setMsgs: setChatMsgs },
    openChat,
    askCookingMate: onAskMate,
  }), [ctx, ingredientIds, canStartNew, remaining, fetchAi, say, tts.speaking, orb, recordEv, stt.listening, toggleMic, stt.supported, chatMsgs, openChat, onAskMate]);

  const rec = recommended(remaining);
  const meta = activity ? ACTIVITY_BY_ID[activity] : null;
  const status = paused ? "Paused" : stt.listening ? (stt.interim ? `“${stt.interim}”` : "Listening…") : thinking ? "Thinking…" : tts.speaking ? "Speaking…" : meta ? "Your turn" : "Pick something fun";

  return (
    <MotionConfig reducedMotion="user">
      <section
        data-chill
        aria-label="Cook and Chill"
        className={`${open ? "flex" : "hidden"} glass-dark fixed inset-x-2 bottom-2 z-40 flex-col overflow-hidden rounded-[2rem] text-cream-50 ${minimized ? "" : "max-h-[64svh]"} lg:static lg:inset-auto lg:z-auto lg:h-[70vh] lg:max-h-none`}
        style={{ boxShadow: "0 30px 90px -30px rgba(0,0,0,0.75), inset 0 1px 0 rgba(255,255,255,0.18)" }}
      >
        <span className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-burgundy/45 blur-[70px]" />
        <span className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-[#2E7D5B]/25 blur-[80px]" />

        {/* header */}
        <header className="relative flex items-center gap-2 border-b border-cream/10 px-3 py-2.5 sm:px-4">
          <div className="hidden sm:block"><ChillOrb state={orbState} persona={persona} size={68} /></div>
          <div className="sm:hidden"><ChillOrb state={orbState} persona={persona} size={44} /></div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {activity && (
                <button onClick={() => { ttsRef.current.cancel(); setActivity(null); }} className="-ml-1 rounded-full p-1 hover:bg-cream/10" aria-label="Back to activities"><ChevronLeft className="h-4 w-4" /></button>
              )}
              <p className="truncate font-display text-base leading-tight sm:text-xl" title={meta?.title}>{meta ? meta.title : "Cook & Chill"}</p>
            </div>
            <p className="flex items-center gap-2 truncate text-[12px] text-cream/70" aria-live="polite">
              {(stt.listening || tts.speaking) && <Waveform active />}
              <span className="truncate">{status}</span>
              {aiLive === false && !activity && <span className="hidden shrink-0 rounded-full bg-cream/10 px-1.5 text-[9px] font-bold uppercase tracking-wider sm:inline" title="Live AI isn't configured — content comes from RANNAMATE's curated library">Library mode</span>}
            </p>
          </div>
          {/* the real cooking timer, read-only */}
          <div className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[13px] font-bold tabular-nums sm:gap-1.5 sm:px-2.5 sm:text-sm ${timerDone ? "bg-cream text-burgundy" : wrap ? "bg-burgundy text-cream-50" : "bg-black/25"}`} title="Your cooking timer" aria-label={`Cooking timer: ${fmt(remaining)} left`}>
            <Timer className="h-3.5 w-3.5" /> {fmt(remaining)}{!running && !timerDone && <span className="text-[9px] uppercase opacity-70">paused</span>}
          </div>
          <div className="flex shrink-0 items-center">
            <button onClick={() => setTrophies((t) => !t)} className={`hidden rounded-full p-2 sm:block ${trophies ? "bg-cream/20" : "hover:bg-cream/10"}`} aria-label="Points and achievements" aria-pressed={trophies}><Trophy className="h-4 w-4" /></button>
            {tts.supported && (
              <button onClick={tts.toggleMute} className="rounded-full p-1.5 hover:bg-cream/10 sm:p-2" aria-label={tts.muted ? "Unmute Mate" : "Mute Mate"} aria-pressed={tts.muted}>{tts.muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}</button>
            )}
            <button onClick={() => { setPaused((p) => !p); halt(); }} className="rounded-full p-1.5 hover:bg-cream/10 sm:p-2" aria-label={paused ? "Resume Cook & Chill" : "Pause Cook & Chill"} aria-pressed={paused}>{paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}</button>
            <button onClick={() => setMinimized((m) => !m)} className="rounded-full p-1.5 hover:bg-cream/10 sm:p-2 lg:hidden" aria-label={minimized ? "Expand" : "Minimise"} aria-expanded={!minimized}>{minimized ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</button>
            <button onClick={onClose} className="rounded-full p-1.5 hover:bg-cream/10 sm:p-2" aria-label="Close Cook & Chill and return to the recipe"><X className="h-4 w-4" /></button>
          </div>
        </header>

        {!minimized && (
          <>
            {/* status banners — cooking always comes first */}
            <AnimatePresence>
              {wrap && !timerDone && (
                <motion.div key="wrap" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="relative overflow-hidden bg-burgundy/60 px-4 py-2 text-[13px]" role="status">
                  ⏳ <strong>Almost time — let&apos;s wrap up.</strong>{nextStepText && <span className="text-cream/85"> Next: {nextStepText.slice(0, 110)}{nextStepText.length > 110 ? "…" : ""}</span>}
                </motion.div>
              )}
              {timerDone && (
                <motion.div key="done" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="relative overflow-hidden bg-cream px-4 py-2 text-[13px] font-semibold text-burgundy" role="alert">
                  ⏰ Timer finished — fun paused. Check your food yourself before moving on.
                </motion.div>
              )}
              {aiNote && aiLive && (
                <motion.p key="ai" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative px-4 pt-2 text-[11px] text-cream/55">{aiNote} — using RANNAMATE&apos;s library for now.</motion.p>
              )}
            </AnimatePresence>

            <div className="no-scrollbar relative flex min-h-0 flex-1 flex-col overflow-y-auto p-3 sm:p-4">
              {paused ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 py-8 text-center">
                  <p className="font-display text-2xl">Paused</p>
                  <p className="max-w-xs text-sm text-cream/70">Take your time with the food. Mate will wait right here.</p>
                  <button onClick={() => setPaused(false)} className="flex items-center gap-1.5 rounded-full bg-cream px-5 py-2 text-sm font-bold text-burgundy"><Play className="h-4 w-4" /> Resume</button>
                </div>
              ) : trophies ? (
                <Trophies stats={stats} unlocked={unlocked.map((u) => u.id)} showPoints={showPoints} onClose={() => setTrophies(false)} />
              ) : !activity ? (
                <div>
                  <p className="mb-3 text-[13px] text-cream/75">{canStartNew ? <>About <strong className="text-cream-50">{fmtLeft(remaining)}</strong> to wait — pick something fun.</> : "No new games right now — your food needs you soon."}</p>
                  <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
                    {ACTIVITIES.map((a, i) => {
                      const Icon = ICONS[a.id];
                      const ok = canStartNew && canStart(a.id, remaining);
                      const best = ok && rec.includes(a.id);
                      return (
                        <motion.button
                          key={a.id}
                          onClick={() => ok && choose(a.id)}
                          disabled={!ok}
                          initial={{ opacity: 0, y: 14 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.035, type: "spring", stiffness: 300, damping: 26 }}
                          whileHover={ok ? { y: -4 } : {}}
                          whileTap={ok ? { scale: 0.95 } : {}}
                          className="group relative flex flex-col items-start gap-1.5 overflow-hidden rounded-[1.25rem] border border-cream/15 bg-gradient-to-b from-cream/[0.11] to-cream/[0.03] p-2.5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] transition-colors hover:border-cream/40 disabled:cursor-not-allowed disabled:opacity-40 sm:p-3"
                          aria-label={`${a.title}${ok ? "" : ` — needs about ${fmtLeft(a.minSeconds)}`}`}
                        >
                          <span className="pointer-events-none absolute -right-6 -top-6 h-16 w-16 rounded-full opacity-30 blur-xl transition-opacity group-hover:opacity-70" style={{ background: a.glow }} />
                          <span className="relative flex h-8 w-8 items-center justify-center rounded-xl ring-1 ring-cream/20 sm:h-9 sm:w-9" style={{ background: `linear-gradient(135deg, ${a.glow}55, transparent)` }}><Icon className="h-4 w-4" /></span>
                          <span className="relative text-[12px] font-bold leading-tight sm:text-[13px]">{a.title}</span>
                          <span className="relative hidden text-[11px] leading-snug text-cream/60 sm:block">{a.blurb}</span>
                          {best && <span className="relative rounded-full bg-cream/90 px-1.5 py-px text-[9px] font-bold uppercase tracking-wider text-forest">Good fit</span>}
                          {!ok && canStartNew && <span className="relative text-[9px] font-semibold text-cream/60">needs ~{fmtLeft(a.minSeconds)}</span>}
                        </motion.button>
                      );
                    })}
                  </div>
                  {safety.note && <p className="mt-3 text-[11px] text-cream/60">👂 {safety.note}</p>}
                </div>
              ) : (
                <AnimatePresence mode="wait">
                  <motion.div key={activity} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} className="flex min-h-0 flex-1 flex-col">
                    {activity === "trivia" && <TriviaGame api={api} />}
                    {activity === "guess" && <GuessGame api={api} />}
                    {activity === "wyr" && <WyrGame api={api} />}
                    {activity === "jokes" && <JokesGame api={api} />}
                    {activity === "facts" && <FactsGame api={api} ingredientName={(id) => ingredient(id).name} />}
                    {activity === "riddles" && <RiddleGame api={api} />}
                    {activity === "chat" && <ChatGame api={api} />}
                    {activity === "story" && <StoryGame api={api} />}
                    {activity === "song" && <SongGame api={api} />}
                  </motion.div>
                </AnimatePresence>
              )}
            </div>

            {/* voice bar */}
            <footer className="relative flex items-center gap-2 border-t border-cream/10 px-3 py-2 text-[11px] text-cream/60 sm:px-4">
              {stt.supported ? (
                <>
                  <button onClick={toggleMic} disabled={paused} className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition disabled:opacity-40 ${stt.listening ? "bg-cream text-burgundy" : "bg-burgundy text-cream-50 hover:scale-105"}`} aria-label={stt.listening ? "Stop listening" : "Talk to Mate"}>
                    {stt.listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    {stt.listening && <span className="absolute inset-0 rounded-full border-2 border-cream animate-pulse-ring" />}
                  </button>
                  {stt.listening ? <Waveform active bars={9} /> : null}
                  <span className="min-w-0 flex-1 truncate">{stt.error ?? (stt.listening ? (stt.interim || "Listening…") : "Tap the mic and answer out loud. Say “stop” or “pause” any time.")}</span>
                </>
              ) : (
                <span className="flex-1">Voice input isn&apos;t available in this browser — tap and type instead.</span>
              )}
              {showPoints && <span className="shrink-0 rounded-full bg-black/25 px-2 py-0.5 font-bold text-cream/80" title="Cook & Chill points">⭐ {stats.points}</span>}
            </footer>
          </>
        )}

        {/* toasts */}
        <div className="pointer-events-none absolute inset-x-0 top-[4.5rem] z-10 flex flex-col items-center gap-1.5" aria-live="polite">
          <AnimatePresence>
            {toasts.map((t) => (
              <motion.span key={t.id} initial={{ opacity: 0, y: -8, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8 }} className="rounded-full bg-cream px-3 py-1 text-xs font-bold text-burgundy shadow-lg">{t.text}</motion.span>
            ))}
          </AnimatePresence>
        </div>
      </section>
    </MotionConfig>
  );
}

function Trophies({ stats, unlocked, showPoints, onClose }: { stats: { points: number; rounds: number }; unlocked: string[]; showPoints: boolean; onClose: () => void }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="font-display text-xl">Your kitchen trophies</p>
        <button onClick={onClose} className="text-xs font-semibold text-cream/70 hover:text-cream">Back</button>
      </div>
      <p className="text-sm text-cream/75">⭐ {stats.points} points · {stats.rounds} rounds played. Just for fun — there&apos;s no leaderboard, and nothing here rewards rushing your cooking.</p>
      <ul className="grid grid-cols-2 gap-2">
        {ACHIEVEMENTS.map((a) => {
          const has = unlocked.includes(a.id);
          return (
            <li key={a.id} className={`rounded-2xl border p-3 ${has ? "border-cream/40 bg-cream/15" : "border-cream/10 opacity-55"}`}>
              <p className="text-2xl" style={{ filter: has ? "none" : "grayscale(1)" }}>{a.emoji}</p>
              <p className="mt-1 text-[13px] font-bold">{a.title}</p>
              <p className="text-[11px] text-cream/65">{a.desc}</p>
            </li>
          );
        })}
      </ul>
      <label className="flex cursor-pointer items-center gap-2 text-[12px] text-cream/75">
        <input type="checkbox" checked={showPoints} onChange={(e) => setShowPoints(e.target.checked)} className="accent-[#F5DABF]" /> Show points and achievement pop-ups
      </label>
    </div>
  );
}
