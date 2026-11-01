"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Ear, Mic, MicOff, RotateCcw, Send, Settings2, Sparkles, Volume2, VolumeX, X, Zap } from "lucide-react";
import { MateAvatar, type AvatarMood, type AvatarState } from "./MateAvatar";
import { CardView } from "./ChatCards";
import { think } from "@/lib/mate/brain";
import { parseTags } from "@/lib/mate/protocol";
import { GREETINGS, line, PERSONAS, VOICE_STYLE } from "@/lib/mate/persona";
import type { ChatMessage, Lang, MateCard, MateTurn, Persona } from "@/lib/mate/types";
import { useSpeechRecognition, useSpeechSynthesis } from "@/lib/voice";
import { useStore } from "@/lib/store";
import { RECIPE_BY_ID } from "@/lib/data/recipes";
import { ingredient } from "@/lib/data/ingredients";

const CHAT_KEY = "rannamate:mate-chat";
const PREF_KEY = "rannamate:mate-prefs";
const uid = () => Math.random().toString(36).slice(2, 10);

function load<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
}
function save(key: string, v: unknown) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* ignore */ }
}

/** Reveals text progressively like a live reply. */
function Typewriter({ text, onDone }: { text: string; onDone: () => void }) {
  const [n, setN] = useState(0);
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    setN(0);
    const step = Math.max(1, Math.round(text.length / 90));
    const t = setInterval(() => setN((x) => { const y = Math.min(text.length, x + step); if (y >= text.length) { clearInterval(t); done.current(); } return y; }), 18);
    return () => clearInterval(t);
  }, [text]);
  return <>{text.slice(0, n)}<span className={n < text.length ? "ml-0.5 inline-block h-4 w-1.5 animate-pulse rounded-sm bg-cream/80 align-middle" : "hidden"} /></>;
}

export function MateStudio() {
  const pantry = useStore((s) => s.pantry);
  const profile = useStore((s) => s.profile);

  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [recipeId, setRecipeId] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [cooking, setCooking] = useState(false);
  const [persona, setPersona] = useState<Persona>("masala");
  const [lang, setLang] = useState<Lang>("en");
  const [handsFree, setHandsFree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [typingId, setTypingId] = useState<string | null>(null);
  const [mood, setMood] = useState<AvatarMood>("happy");
  const [ai, setAi] = useState<{ live: boolean; provider: string | null } | null>(null);
  const [input, setInput] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const tts = useSpeechSynthesis();

  // ---- restore + greet ----
  useEffect(() => {
    const prefs = load<{ persona?: Persona; lang?: Lang }>(PREF_KEY, {});
    if (prefs.persona) setPersona(prefs.persona);
    if (prefs.lang) setLang(prefs.lang);
    const saved = load<{ msgs: ChatMessage[]; recipeId: string | null; step: number; cooking: boolean } | null>(CHAT_KEY, null);
    if (saved?.msgs?.length) {
      setMsgs(saved.msgs);
      setRecipeId(saved.recipeId && RECIPE_BY_ID[saved.recipeId] ? saved.recipeId : null);
      setStep(saved.step ?? 0);
      setCooking(!!saved.cooking);
    } else {
      setMsgs([{ id: uid(), who: "mate", text: line(GREETINGS, prefs.persona ?? "masala", prefs.lang ?? "en"), at: Date.now() }]);
    }
    setHydrated(true);
    fetch("/api/mate").then((r) => r.json()).then(setAi).catch(() => setAi({ live: false, provider: null }));
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    // timers are live widgets — don't restore them after a reload
    const slim = msgs.slice(-40).map((m) => ({ ...m, cards: m.cards?.filter((c) => c.type !== "timer") }));
    save(CHAT_KEY, { msgs: slim, recipeId, step, cooking });
  }, [msgs, recipeId, step, cooking, hydrated]);

  useEffect(() => { if (hydrated) save(PREF_KEY, { persona, lang }); }, [persona, lang, hydrated]);

  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }); }, [msgs, busy, typingId]);

  const recipe = recipeId ? RECIPE_BY_ID[recipeId] : null;

  const applyTurn = useCallback((turn: MateTurn, source: "ai" | "offline") => {
    const e = turn.effects;
    if (e.setRecipe !== undefined) setRecipeId(e.setRecipe);
    if (e.setStep !== undefined) setStep(e.setStep);
    if (e.setCooking !== undefined) setCooking(e.setCooking);
    setMood(turn.mood ?? "happy");
    const m: ChatMessage = { id: uid(), who: "mate", text: turn.text, cards: turn.cards, source, at: Date.now() };
    setMsgs((x) => [...x, m]);
    setTypingId(m.id);
    tts.speak(turn.text, VOICE_STYLE[persona]);
  }, [persona, tts]);

  const send = useCallback(async (raw: string) => {
    const text = raw.trim();
    if (!text || busy) return;
    const user: ChatMessage = { id: uid(), who: "user", text, at: Date.now() };
    const history = [...msgs, user];
    setMsgs(history);
    setInput("");
    setBusy(true);
    setMood("thinking");

    const ctx = { recipeId, step, cooking, pantry: pantry.map((p) => p.ingredientId), persona, lang, allergies: profile.allergies, diets: profile.diets };

    if (ai?.live) {
      try {
        const res = await fetch("/api/mate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...ctx, messages: history.map((m) => ({ who: m.who, text: m.text })) }),
        });
        if (res.ok) {
          const data = (await res.json()) as { text: string };
          const parsed = parseTags(data.text, { recipeId });
          setBusy(false);
          applyTurn({ text: parsed.text || "🙂", cards: parsed.cards, effects: parsed.effects, mood: "happy" }, "ai");
          return;
        }
      } catch { /* fall through to the offline brain */ }
    }
    await new Promise((r) => setTimeout(r, 450 + Math.random() * 450));
    const turn = think(text, ctx);
    setBusy(false);
    applyTurn(turn, "offline");
  }, [busy, msgs, recipeId, step, cooking, pantry, persona, lang, profile, ai, applyTurn]);

  const stt = useSpeechRecognition(send);

  useEffect(() => {
    if (handsFree && stt.supported && !stt.listening && !busy && !tts.speaking && !typingId && !stt.error) {
      const t = setTimeout(stt.start, 600);
      return () => clearTimeout(t);
    }
  }, [handsFree, stt, busy, tts.speaking, typingId]);

  const onTimerDone = useCallback((label: string) => {
    const t = lang === "hinglish" ? `⏰ ${label} ka time ho gaya! Check karo.` : `⏰ Time's up for ${label}! Go check it.`;
    setMsgs((x) => [...x, { id: uid(), who: "mate", text: t, source: "offline", at: Date.now() }]);
    tts.speak(t, VOICE_STYLE[persona]);
  }, [lang, persona, tts]);

  const reset = () => {
    tts.cancel();
    setRecipeId(null); setStep(0); setCooking(false); setTypingId(null);
    setMsgs([{ id: uid(), who: "mate", text: line(GREETINGS, persona, lang), at: Date.now() }]);
  };

  const avatarState: AvatarState = stt.listening ? "listening" : busy ? "thinking" : tts.speaking || typingId ? "talking" : "idle";
  const status = stt.listening ? (stt.interim ? `“${stt.interim}”` : lang === "hinglish" ? "Sun raha hoon… bolo!" : "I'm listening… go ahead!") : busy ? (lang === "hinglish" ? "Soch raha hoon… 🤔" : "Cooking up an answer… 🤔") : tts.speaking ? (lang === "hinglish" ? "Bol raha hoon…" : "Talking…") : cooking && recipe ? `Cooking ${recipe.name} · step ${step + 1}/${recipe.steps.length}` : lang === "hinglish" ? "Mic dabao ya type karo" : "Tap the mic or type a message";

  const prompts = useMemo(() => {
    if (cooking) return ["Next", "Repeat", "Start timer", "Back", "Can I add more chilli?", "How long for this step?"];
    if (recipe) return ["Let's cook!", `${recipe.name} for 4 people`, "Can I skip garlic?", "Make it less spicy", "How much salt?"];
    return ["I have eggs, tomato & onion", "Something spicy under 20 min", "Surprise me! 🎲", "What can I make from my kitchen?", "Healthy Indian dinner", "Tell me a food joke 😄"];
  }, [cooking, recipe]);

  const accent = persona === "chatpata" ? "from-[#E2442F]/50" : persona === "masala" ? "from-burgundy/60" : "from-[#2E7D5B]/50";

  return (
    <div className="relative min-h-[100svh] overflow-hidden bg-forest-900 text-cream-50">
      {/* ambient */}
      <div className={`pointer-events-none absolute -left-32 -top-32 h-[36rem] w-[36rem] rounded-full bg-gradient-to-br ${accent} to-transparent blur-[110px] transition-colors duration-1000`} />
      <div className="pointer-events-none absolute -bottom-40 right-0 h-[34rem] w-[34rem] rounded-full bg-burgundy/40 blur-[120px]" />
      <div className="pointer-events-none absolute inset-0 select-none text-6xl opacity-[0.07]" aria-hidden>
        {["🍅", "🧄", "🌶️", "🥚", "🧅", "🌿", "🍋", "🥔"].map((e, i) => (
          <span key={i} className="absolute animate-float" style={{ left: `${(i * 13 + 5) % 95}%`, top: `${(i * 29 + 12) % 90}%`, animationDelay: `${-i * 0.8}s` }}>{e}</span>
        ))}
      </div>

      <div className="relative mx-auto grid max-w-7xl grid-cols-1 gap-4 px-3 pb-4 pt-24 sm:px-6 lg:h-[100svh] lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)_280px]">
        {/* ---------- left: Mate stage ---------- */}
        <aside className="glass-dark relative flex flex-col items-center rounded-[2rem] p-4 lg:p-5">
          <div className="flex w-full items-center justify-between">
            <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest ${ai?.live ? "bg-[#2E7D5B] text-white" : "bg-cream/15 text-cream/80"}`} title={ai?.live ? "Answers come from a generative AI model" : "Add an API key in .env.local for live AI"}>
              {ai?.live ? <><Zap className="h-3 w-3" /> Live AI · {ai.provider}</> : ai ? <><Sparkles className="h-3 w-3" /> Offline brain</> : "…"}
            </span>
            <button onClick={() => setShowSettings((s) => !s)} className="rounded-full p-2 hover:bg-cream/10 lg:hidden" aria-label="Mate settings" aria-expanded={showSettings}><Settings2 className="h-4 w-4" /></button>
          </div>

          <div className="flex w-full items-center gap-4 lg:flex-col lg:gap-1">
            <div className="shrink-0 lg:my-2">
              <div className="hidden lg:block"><MateAvatar state={avatarState} mood={mood} persona={persona} size={210} /></div>
              <div className="lg:hidden"><MateAvatar state={avatarState} mood={mood} persona={persona} size={92} /></div>
            </div>
            <div className="min-w-0 flex-1 lg:text-center">
              <p className="font-display text-2xl font-semibold lg:text-3xl">Mate</p>
              <p className="truncate text-sm text-cream/75 lg:whitespace-normal" aria-live="polite">{status}</p>
            </div>
            {/* big mic */}
            {stt.supported && (
              <button
                onClick={stt.listening ? stt.stop : () => { tts.cancel(); stt.start(); }}
                className={`relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full shadow-xl transition lg:mt-4 lg:h-20 lg:w-20 ${stt.listening ? "bg-cream text-burgundy" : "bg-burgundy text-cream-50 hover:scale-105"}`}
                aria-label={stt.listening ? "Stop listening" : "Talk to Mate"}
              >
                {stt.listening ? <MicOff className="h-6 w-6 lg:h-8 lg:w-8" /> : <Mic className="h-6 w-6 lg:h-8 lg:w-8" />}
                {stt.listening && <span className="absolute inset-0 rounded-full border-2 border-cream animate-pulse-ring" />}
              </button>
            )}
          </div>
          {stt.error && <p className="mt-2 w-full rounded-xl bg-burgundy/40 px-3 py-2 text-xs">{stt.error}</p>}
          {!stt.supported && hydrated && <p className="mt-2 w-full text-center text-[11px] text-cream/60">Voice input needs Chrome, Edge or Safari. Typing works everywhere.</p>}

          <div className={`${showSettings ? "flex" : "hidden"} mt-4 w-full flex-col gap-4 lg:flex`}>
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-cream/60">Spice level</p>
              <div className="grid grid-cols-3 gap-1 rounded-2xl bg-black/20 p-1">
                {PERSONAS.map((p) => (
                  <button key={p.id} onClick={() => setPersona(p.id)} aria-pressed={persona === p.id} className={`relative rounded-xl px-1 py-2 text-center transition ${persona === p.id ? "text-forest" : "text-cream/80 hover:bg-cream/10"}`}>
                    {persona === p.id && <motion.span layoutId="spice" className="absolute inset-0 rounded-xl bg-cream" transition={{ type: "spring", stiffness: 400, damping: 30 }} />}
                    <span className="relative block text-lg">{p.emoji}</span>
                    <span className="relative block text-[10px] font-bold leading-tight">{p.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="grid grid-cols-2 gap-1 rounded-full bg-black/20 p-1 text-[11px] font-bold">
                {(["en", "hinglish"] as const).map((l) => (
                  <button key={l} onClick={() => setLang(l)} aria-pressed={lang === l} className={`rounded-full px-3 py-1.5 ${lang === l ? "bg-cream text-forest" : "text-cream/80"}`}>{l === "en" ? "English" : "Hinglish"}</button>
                ))}
              </div>
              <div className="flex gap-1">
                {tts.supported && (
                  <button onClick={tts.toggleMute} className={`rounded-full p-2 ${tts.muted ? "bg-black/20 text-cream/60" : "bg-cream/15"}`} aria-label={tts.muted ? "Turn voice replies on" : "Mute voice replies"} aria-pressed={!tts.muted} title="Voice replies">
                    {tts.muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                  </button>
                )}
                {stt.supported && (
                  <button onClick={() => { setHandsFree((h) => !h); if (handsFree) stt.stop(); }} className={`rounded-full p-2 ${handsFree ? "bg-cream text-forest" : "bg-black/20 text-cream/70"}`} aria-pressed={handsFree} aria-label="Hands-free mode" title="Hands-free: keeps listening between replies">
                    <Ear className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
            {handsFree && <p className="-mt-2 text-[11px] text-cream/60">Hands-free on — just talk. Say “next”, “repeat” or “start timer” while cooking.</p>}
          </div>
        </aside>

        {/* ---------- centre: chat ---------- */}
        <section className="glass-dark relative flex min-h-[70svh] flex-col overflow-hidden rounded-[2rem] lg:min-h-0">
          <header className="flex items-center gap-2 border-b border-cream/10 px-4 py-3">
            {recipe ? (
              <span className="flex min-w-0 items-center gap-2 rounded-full bg-cream/10 py-1 pl-1 pr-3 text-sm">
                <span className="flex h-7 w-7 items-center justify-center rounded-full text-base" style={{ background: `linear-gradient(135deg, ${recipe.palette[0]}, ${recipe.palette[1]})` }}>{recipe.emoji}</span>
                <span className="truncate font-semibold">{recipe.name}</span>
                {cooking && <span className="shrink-0 rounded-full bg-cream px-2 py-0.5 text-[10px] font-bold text-burgundy">COOKING</span>}
                <button onClick={() => { setRecipeId(null); setCooking(false); }} aria-label="Clear recipe" className="text-cream/60 hover:text-cream"><X className="h-3.5 w-3.5" /></button>
              </span>
            ) : (
              <span className="text-sm text-cream/70">{lang === "hinglish" ? "Kuch bhi poocho — recipes, swaps, timers…" : "Ask anything — recipes, swaps, timers…"}</span>
            )}
            <button onClick={reset} className="ml-auto flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-cream/70 hover:bg-cream/10"><RotateCcw className="h-3.5 w-3.5" /> New chat</button>
          </header>

          <div ref={listRef} className="no-scrollbar flex-1 space-y-4 overflow-y-auto px-3 py-5 sm:px-5" aria-live="polite">
            {msgs.map((m) => (
              <motion.div key={m.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 260, damping: 24 }} className={`flex gap-2.5 ${m.who === "user" ? "justify-end" : ""}`}>
                {m.who === "mate" && <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cream/15 text-base">🧑‍🍳</span>}
                <div className={`flex min-w-0 max-w-[88%] flex-col gap-2.5 ${m.who === "user" ? "items-end" : ""}`}>
                  <div className={`rounded-3xl px-4 py-2.5 text-[15px] leading-relaxed ${m.who === "user" ? "rounded-br-md bg-cream text-forest" : "rounded-tl-md text-cream-50 ring-1 ring-cream/10"}`} style={m.who === "mate" ? { background: "rgba(245,218,191,0.1)" } : undefined}>
                    {m.id === typingId ? <Typewriter text={m.text} onDone={() => setTypingId(null)} /> : m.text}
                    {m.source === "ai" && <span className="ml-2 inline-flex translate-y-[-1px] items-center gap-0.5 rounded-full bg-[#2E7D5B]/60 px-1.5 text-[9px] font-bold uppercase tracking-wider">AI</span>}
                  </div>
                  {(m.id !== typingId) && m.cards?.map((c, i) => <CardView key={i} card={c as MateCard} onSend={send} onTimerDone={onTimerDone} />)}
                </div>
              </motion.div>
            ))}
            {busy && (
              <div className="flex gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-cream/15">🧑‍🍳</span>
                <div className="flex items-center gap-1.5 rounded-3xl rounded-tl-md bg-cream/10 px-4 py-3">
                  {["🌶️", "🧄", "🍅"].map((e, d) => <motion.span key={d} className="text-sm" animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 0.7, delay: d * 0.14 }}>{e}</motion.span>)}
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-cream/10 p-3">
            <div className="no-scrollbar mb-2.5 flex gap-1.5 overflow-x-auto">
              <AnimatePresence mode="popLayout">
                {prompts.map((p) => (
                  <motion.button layout key={p} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} onClick={() => send(p)} disabled={busy} className="shrink-0 rounded-full border border-cream/20 bg-cream/5 px-3.5 py-1.5 text-[12px] font-semibold text-cream/90 transition hover:bg-cream/15 disabled:opacity-40">
                    {p}
                  </motion.button>
                ))}
              </AnimatePresence>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex items-center gap-2 rounded-full bg-cream/10 p-1.5 pl-5 ring-1 ring-cream/15 focus-within:ring-cream/40">
              <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} placeholder={lang === "hinglish" ? "Mate se baat karo…" : "Message Mate…"} className="min-w-0 flex-1 bg-transparent text-[15px] text-cream-50 outline-none placeholder:text-cream/45" aria-label="Message Mate" />
              {stt.supported && (
                <button type="button" onClick={stt.listening ? stt.stop : () => { tts.cancel(); stt.start(); }} className={`flex h-10 w-10 items-center justify-center rounded-full ${stt.listening ? "bg-cream text-burgundy" : "bg-cream/15 text-cream"}`} aria-label={stt.listening ? "Stop listening" : "Speak"}>
                  {stt.listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </button>
              )}
              <button type="submit" disabled={!input.trim() || busy} className="flex h-10 w-10 items-center justify-center rounded-full bg-burgundy text-cream-50 transition hover:bg-burgundy-300 disabled:opacity-40" aria-label="Send">
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </section>

        {/* ---------- right: context ---------- */}
        <aside className="hidden flex-col gap-4 xl:flex">
          <div className="glass-dark rounded-[2rem] p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cream/60">On the stove</p>
            {recipe ? (
              <>
                <div className="mt-3 flex items-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl text-2xl" style={{ background: `radial-gradient(circle at 30% 25%, ${recipe.palette[0]}, ${recipe.palette[1]})` }}>{recipe.emoji}</span>
                  <div className="min-w-0">
                    <p className="truncate font-display text-lg font-semibold">{recipe.name}</p>
                    <p className="text-[11px] text-cream/65">{recipe.prepMin + recipe.cookMin} min · {recipe.steps.length} steps</p>
                  </div>
                </div>
                <ol className="mt-3 max-h-[38svh] space-y-1 overflow-y-auto pr-1">
                  {recipe.steps.map((s, i) => (
                    <li key={i}>
                      <button onClick={() => send(cooking ? `go to step ${i + 1}` : `Let's cook ${recipe.name}`)} className={`flex w-full gap-2 rounded-xl px-2 py-1.5 text-left text-[12px] leading-snug transition ${cooking && i === step ? "bg-cream text-forest" : cooking && i < step ? "text-cream/40 line-through" : "text-cream/80 hover:bg-cream/10"}`}>
                        <span className="font-bold">{i + 1}.</span><span className="line-clamp-2">{s.text}</span>
                      </button>
                    </li>
                  ))}
                </ol>
              </>
            ) : (
              <p className="mt-3 text-sm text-cream/65">Nothing cooking yet. Ask Mate for an idea, or tap a recipe card.</p>
            )}
          </div>
          <div className="glass-dark rounded-[2rem] p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cream/60">My kitchen</p>
            {pantry.length ? (
              <>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {pantry.slice(0, 12).map((p) => <span key={p.ingredientId} className="rounded-full bg-cream/10 px-2 py-1 text-[11px]">{ingredient(p.ingredientId).emoji} {ingredient(p.ingredientId).name}</span>)}
                </div>
                <button onClick={() => send("What can I make from my kitchen?")} disabled={busy} className="mt-3 w-full rounded-full bg-cream px-3 py-2 text-xs font-bold text-forest">Cook from my kitchen</button>
              </>
            ) : (
              <p className="mt-3 text-sm text-cream/65">Empty. <Link href="/kitchen" className="font-semibold text-cream underline underline-offset-4">Add ingredients</Link> or just tell Mate what you have.</p>
            )}
          </div>
          {!ai?.live && ai && (
            <p className="px-2 text-[11px] leading-relaxed text-cream/50">Mate is using its built-in recipe brain. Add <code className="text-cream/80">GEMINI_API_KEY</code> or <code className="text-cream/80">ANTHROPIC_API_KEY</code> to <code className="text-cream/80">frontend/.env.local</code> for live generative answers.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
