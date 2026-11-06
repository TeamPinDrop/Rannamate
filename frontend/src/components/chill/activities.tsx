"use client";
import { Fragment, useCallback, useEffect, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, Check, ChefHat, Eye, Lightbulb, Mic, MicOff, Play, RefreshCw, Send, Square, X } from "lucide-react";
import {
  COOKING_Q, isMatch, libraryChat, libraryGuess, libraryJoke, libraryRiddle, librarySong, libraryTrivia, libraryWyr, libraryWyrReaction, pickOption, storyBeatsFor, voiceCommand,
} from "@/lib/chill/engine";
import { CHAT_STARTERS, FACTS, STORIES } from "@/lib/chill/library";
import type { ChatReply, ChillContext, ChillRequest, ChillSource, Fact, GuessQ, Joke, Level, Riddle, Song, StoryBeat, TriviaQ, WyrQ, WyrReaction } from "@/lib/chill/types";
import type { ChillEvent } from "@/lib/chill/store";
import type { OrbState } from "./ChillOrb";

// ---------------------------------------------------------------- shared plumbing

export type VoiceHandler = (text: string, cmd: ReturnType<typeof voiceCommand>) => void;
export type ChatMsg = { who: "user" | "mate"; text: string; source?: ChillSource; cooking?: boolean };
type Dist<T> = T extends unknown ? Omit<T, "ctx"> : never;

export interface ChillApi {
  ctx: ChillContext;
  ingredientIds: string[];
  /** false during the wrap-up window — finish the current item, don't start a new one */
  canStartNew: boolean;
  remaining: number;
  fetchAi: <T>(req: Dist<ChillRequest>) => Promise<{ data: T; source: "ai" } | null>;
  say: (text: string, opts?: { rate?: number; pitch?: number }) => void;
  stopVoice: () => void;
  speaking: boolean;
  orb: (s: OrbState) => void;
  record: (ev: ChillEvent) => void;
  remember: (id: string) => void;
  recent: () => string[];
  voice: MutableRefObject<VoiceHandler | null>;
  listening: boolean;
  toggleMic: () => void;
  micSupported: boolean;
  chat: { msgs: ChatMsg[]; setMsgs: (fn: (m: ChatMsg[]) => ChatMsg[]) => void };
  openChat: (mateLine: string) => void;
  askCookingMate: () => void;
}

const LETTERS = ["A", "B", "C", "D"];

function SourceTag({ source }: { source: ChillSource }) {
  return source === "ai" ? (
    <span className="rounded-full bg-[#2E7D5B]/70 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white" title="Generated live by RANNAMATE AI">AI</span>
  ) : (
    <span className="rounded-full bg-cream/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-cream/75" title="From RANNAMATE's curated library (live AI off or unavailable)">Library</span>
  );
}

function Busy({ label = "Mate is thinking…" }: { label?: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-10 text-cream/70" role="status">
      <div className="flex gap-1.5">{["🌶️", "🧄", "🍅"].map((e, d) => <motion.span key={d} animate={{ y: [0, -7, 0] }} transition={{ repeat: Infinity, duration: 0.7, delay: d * 0.14 }}>{e}</motion.span>)}</div>
      <p className="text-sm">{label}</p>
    </div>
  );
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <motion.div initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 26 }} className={`rounded-[1.5rem] border border-cream/15 bg-cream/[0.07] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] ${className}`}>{children}</motion.div>;
}

function NextButton({ api, onClick, children, disabled }: { api: ChillApi; onClick: () => void; children: ReactNode; disabled?: boolean }) {
  const blocked = !api.canStartNew;
  return (
    <button onClick={onClick} disabled={blocked || disabled} className="flex items-center gap-1.5 rounded-full bg-cream px-4 py-2 text-sm font-bold text-burgundy transition hover:bg-cream-50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40" title={blocked ? "Your timer is almost up — time to check the food" : undefined}>
      {blocked ? "Timer's almost up" : children}
    </button>
  );
}

function LevelPicker({ value, onChange }: { value: Level; onChange: (l: Level) => void }) {
  return (
    <div className="flex gap-1 rounded-full bg-black/20 p-1 text-[11px] font-bold" role="radiogroup" aria-label="Difficulty">
      {(["easy", "medium", "hard"] as Level[]).map((l) => (
        <button key={l} role="radio" aria-checked={value === l} onClick={() => onChange(l)} className={`rounded-full px-2.5 py-1 capitalize transition ${value === l ? "bg-cream text-forest" : "text-cream/75 hover:bg-cream/10"}`}>{l}</button>
      ))}
    </div>
  );
}

/** Answer box with a mic button that feeds the panel's speech recognition. */
function AnswerBox({ api, onSubmit, placeholder, disabled }: { api: ChillApi; onSubmit: (t: string) => void; placeholder: string; disabled?: boolean }) {
  const [v, setV] = useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); const t = v.trim(); if (t) { onSubmit(t); setV(""); } }} className="mt-3 flex items-center gap-2 rounded-full bg-cream/10 p-1.5 pl-4 ring-1 ring-cream/15 focus-within:ring-cream/40">
      <input value={v} onChange={(e) => setV(e.target.value.slice(0, 200))} disabled={disabled} placeholder={placeholder} className="min-w-0 flex-1 bg-transparent text-sm text-cream-50 outline-none placeholder:text-cream/45 disabled:opacity-50" aria-label={placeholder} maxLength={200} />
      {api.micSupported && (
        <button type="button" onClick={api.toggleMic} disabled={disabled} className={`flex h-9 w-9 items-center justify-center rounded-full transition ${api.listening ? "bg-cream text-burgundy" : "bg-cream/15 text-cream hover:bg-cream/25"}`} aria-label={api.listening ? "Stop listening" : "Answer with your voice"}>
          {api.listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </button>
      )}
      <button type="submit" disabled={disabled || !v.trim()} className="flex h-9 w-9 items-center justify-center rounded-full bg-burgundy text-cream-50 disabled:opacity-40" aria-label="Submit"><Send className="h-4 w-4" /></button>
    </form>
  );
}

const useVoice = (api: ChillApi, fn: VoiceHandler) => {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    api.voice.current = (t, c) => ref.current(t, c);
    return () => { api.voice.current = null; };
  }, [api.voice]);
};

/** Loads the first item once on mount (and survives React strict-mode double effects). */
const useFirstLoad = (load: () => void) => {
  const did = useRef(false);
  useEffect(() => { if (!did.current) { did.current = true; load(); } }, [load]);
};

// ---------------------------------------------------------------- 01 · Food Trivia

export function TriviaGame({ api }: { api: ChillApi }) {
  const [level, setLevel] = useState<Level>("medium");
  const [q, setQ] = useState<{ q: TriviaQ; source: ChillSource } | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState({ right: 0, total: 0 });
  const [loading, setLoading] = useState(false);
  const lvl = useRef(level);
  lvl.current = level;

  const load = useCallback(async () => {
    setLoading(true); setPicked(null); api.orb("thinking");
    const r = await api.fetchAi<TriviaQ>({ activity: "trivia", difficulty: lvl.current, recent: api.recent() });
    const item = r ? { q: r.data, source: "ai" as const } : { q: libraryTrivia(lvl.current, api.recent()), source: "library" as const };
    api.remember(item.source === "ai" ? item.q.question : item.q.id);
    setQ(item); setLoading(false); api.orb("idle");
    api.say(`Chef! Quick question. ${item.q.question} ${item.q.options.map((o, i) => `${LETTERS[i]}: ${o}.`).join(" ")}`);
  }, [api]);
  useFirstLoad(load);

  const answer = (i: number) => {
    if (!q || picked !== null) return;
    setPicked(i);
    const ok = i === q.q.correct;
    setScore((s) => ({ right: s.right + (ok ? 1 : 0), total: s.total + 1 }));
    api.record({ type: "trivia", correct: ok, level: q.q.difficulty });
    api.orb(ok ? "celebrate" : "oops");
    api.say(ok ? `Correct! ${q.q.explanation} You're becoming a food expert!` : `Not quite — it's ${q.q.options[q.q.correct]}. ${q.q.explanation}`);
  };

  useVoice(api, (t, cmd) => {
    if (cmd === "next" && picked !== null && api.canStartNew) return void load();
    if (cmd === "repeat" && q) return api.say(`${q.q.question} ${q.q.options.map((o, i) => `${LETTERS[i]}: ${o}.`).join(" ")}`);
    if (q && picked === null) { const i = pickOption(t, q.q.options); if (i !== null) answer(i); }
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <LevelPicker value={level} onChange={setLevel} />
        <span className="text-xs font-semibold text-cream/70" aria-live="polite">{score.right}/{score.total} correct</span>
      </div>
      {loading || !q ? <Busy label="Finding a good question…" /> : (
        <Card>
          <div className="flex items-center gap-2"><SourceTag source={q.source} /><span className="text-[10px] font-bold uppercase tracking-widest text-cream/50">{q.q.difficulty}</span></div>
          <p className="mt-2 font-display text-xl leading-snug text-cream-50">{q.q.question}</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {q.q.options.map((o, i) => {
              const state = picked === null ? "idle" : i === q.q.correct ? "right" : i === picked ? "wrong" : "dim";
              return (
                <motion.button key={o} onClick={() => answer(i)} disabled={picked !== null} whileTap={{ scale: 0.97 }} animate={state === "wrong" ? { x: [0, -5, 5, -3, 0] } : {}} className={`flex items-center gap-2.5 rounded-2xl border px-3 py-2.5 text-left text-sm font-semibold transition ${state === "right" ? "border-[#7FD19B] bg-[#2E7D5B]/50 text-white" : state === "wrong" ? "border-burgundy-300 bg-burgundy/50" : state === "dim" ? "border-cream/10 opacity-50" : "border-cream/20 bg-cream/5 hover:border-cream/50 hover:bg-cream/10"}`}>
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${state === "right" ? "bg-white text-[#2E7D5B]" : "bg-cream/15"}`}>{state === "right" ? <Check className="h-3.5 w-3.5" /> : LETTERS[i]}</span>
                  {o}
                </motion.button>
              );
            })}
          </div>
          <AnimatePresence>
            {picked !== null && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="overflow-hidden">
                <p className="mt-3 text-sm text-cream/85"><strong className="text-cream-50">{picked === q.q.correct ? "Correct! " : "Not quite. "}</strong>{q.q.explanation}</p>
                <div className="mt-3"><NextButton api={api} onClick={load}><RefreshCw className="h-4 w-4" /> Next question</NextButton></div>
              </motion.div>
            )}
          </AnimatePresence>
          {picked === null && <p className="mt-3 text-[11px] text-cream/50">Tap an answer, or say “B” or the answer itself.</p>}
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- 02 · Guess the Ingredient

export function GuessGame({ api }: { api: ChillApi }) {
  const [level, setLevel] = useState<Level>("medium");
  const [g, setG] = useState<{ q: GuessQ; source: ChillSource } | null>(null);
  const [shown, setShown] = useState(1);
  const [status, setStatus] = useState<"playing" | "solved" | "revealed">("playing");
  const [miss, setMiss] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const lvl = useRef(level);
  lvl.current = level;

  const load = useCallback(async () => {
    setLoading(true); setStatus("playing"); setShown(1); setMiss(null); api.orb("thinking");
    const r = await api.fetchAi<GuessQ>({ activity: "guess", difficulty: lvl.current, recent: api.recent() });
    const item = r ? { q: r.data, source: "ai" as const } : { q: libraryGuess(lvl.current, api.recent(), api.ingredientIds), source: "library" as const };
    api.remember(item.source === "ai" ? item.q.answer : item.q.id);
    setG(item); setLoading(false); api.orb("idle");
    api.say(`Guess who I am! ${item.q.clues[0]}`);
  }, [api]);
  useFirstLoad(load);

  const hint = () => {
    if (!g || shown >= g.q.clues.length) return;
    setShown((n) => n + 1);
    api.say(g.q.clues[shown]);
  };
  const reveal = () => {
    if (!g) return;
    setStatus("revealed"); setShown(g.q.clues.length);
    api.record({ type: "guess", solved: false, hints: shown - 1 });
    api.say(`I was ${g.q.answer}! Next time!`);
  };
  const guess = (t: string) => {
    if (!g || status !== "playing") return;
    if (isMatch(t, g.q.aliases)) {
      setStatus("solved"); setMiss(null);
      api.record({ type: "guess", solved: true, hints: shown - 1 });
      api.orb("celebrate");
      api.say(`Exactly! I'm ${g.q.answer}. You're absolutely right!`);
    } else {
      setMiss(t); api.orb("oops");
      api.say(shown < g.q.clues.length ? "Not me! Want another clue?" : "Nope! Have one more go, or give up.");
    }
  };

  useVoice(api, (t, cmd) => {
    if (cmd === "hint") return hint();
    if (cmd === "reveal") return reveal();
    if (cmd === "next" && status !== "playing" && api.canStartNew) return void load();
    if (cmd === "repeat" && g) return api.say(g.q.clues.slice(0, shown).join(" "));
    if (!cmd) guess(t);
  });

  const blur = status !== "playing" ? 0 : Math.max(0, 18 - (shown - 1) * 7);
  return (
    <div className="flex flex-col gap-3">
      <LevelPicker value={level} onChange={setLevel} />
      {loading || !g ? <Busy label="Hiding an ingredient…" /> : (
        <Card>
          <div className="flex items-start gap-4">
            <motion.div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-gradient-to-br from-cream/25 to-cream/5 text-5xl ring-1 ring-cream/20" animate={{ filter: `blur(${blur}px)`, scale: status === "solved" ? [1, 1.2, 1] : 1 }} transition={{ duration: 0.6 }} aria-label={status === "playing" ? "Mystery ingredient — gets clearer with each clue" : g.q.answer}>
              {g.q.emoji}
            </motion.div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2"><SourceTag source={g.source} /><span className="text-[10px] font-bold uppercase tracking-widest text-cream/50">Clue {Math.min(shown, g.q.clues.length)} of {g.q.clues.length}</span></div>
              <ol className="mt-2 space-y-1.5">
                {g.q.clues.slice(0, shown).map((c, i) => (
                  <motion.li key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="text-[15px] leading-snug text-cream-50">“{c}”</motion.li>
                ))}
              </ol>
            </div>
          </div>
          {status === "playing" ? (
            <>
              <AnswerBox api={api} onSubmit={guess} placeholder="Who am I?" />
              {miss && <p className="mt-2 text-xs text-cream/70">“{miss}” — not quite!</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                <button onClick={hint} disabled={shown >= g.q.clues.length} className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ring-1 ring-cream/25 hover:bg-cream/10 disabled:opacity-40"><Lightbulb className="h-3.5 w-3.5" /> Another clue</button>
                <button onClick={reveal} className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-cream/70 hover:bg-cream/10"><Eye className="h-3.5 w-3.5" /> I give up</button>
              </div>
            </>
          ) : (
            <div className="mt-3">
              <p className="font-display text-2xl text-cream-50">{status === "solved" ? "🎉 " : ""}{g.q.answer}</p>
              <div className="mt-3"><NextButton api={api} onClick={load}><RefreshCw className="h-4 w-4" /> Another ingredient</NextButton></div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- 03 · Would You Rather?

export function WyrGame({ api }: { api: ChillApi }) {
  const [q, setQ] = useState<{ q: WyrQ; source: ChillSource } | null>(null);
  const [picked, setPicked] = useState<"a" | "b" | null>(null);
  const [react, setReact] = useState<{ r: WyrReaction; source: ChillSource } | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setPicked(null); setReact(null); api.orb("thinking");
    const r = await api.fetchAi<WyrQ>({ activity: "wyr", recent: api.recent() });
    const item = r ? { q: r.data, source: "ai" as const } : { q: libraryWyr(api.recent()), source: "library" as const };
    api.remember(item.source === "ai" ? `${item.q.a} / ${item.q.b}` : item.q.id);
    setQ(item); setLoading(false); api.orb("idle");
    api.say(`Would you rather ${item.q.a.toLowerCase()}, or ${item.q.b.toLowerCase()}?`);
  }, [api]);
  useFirstLoad(load);

  const choose = async (side: "a" | "b") => {
    if (!q || picked) return;
    setPicked(side);
    api.record({ type: "round" });
    api.orb("thinking");
    const choice = side === "a" ? q.q.a : q.q.b;
    const r = await api.fetchAi<WyrReaction>({ activity: "wyr-react", question: { a: q.q.a, b: q.q.b }, picked: choice });
    const item = r ? { r: r.data, source: "ai" as const } : { r: libraryWyrReaction(), source: "library" as const };
    setReact(item); api.orb("celebrate");
    api.say(`${item.r.reaction} ${item.r.followUp}`);
  };

  useVoice(api, (t, cmd) => {
    if (cmd === "next" && api.canStartNew) return void load();
    if (!q || picked) return;
    const i = pickOption(t, [q.q.a, q.q.b]);
    if (i !== null) void choose(i === 0 ? "a" : "b");
  });

  if (loading || !q) return <Busy label="Cooking up a tough choice…" />;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2"><SourceTag source={q.source} /><p className="font-display text-xl text-cream-50">Would you rather…</p></div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch">
        {(["a", "b"] as const).map((side, k) => (
          <Fragment key={side}>
            {k === 1 && <span className="self-center text-center text-xs font-bold uppercase tracking-widest text-cream/50">or</span>}
            <motion.button onClick={() => choose(side)} disabled={!!picked} whileHover={!picked ? { y: -3 } : {}} whileTap={{ scale: 0.97 }} className={`flex flex-col items-center gap-2 rounded-[1.5rem] border p-4 text-center transition ${picked === side ? "border-cream bg-cream/20" : picked ? "border-cream/10 opacity-45" : "border-cream/20 bg-cream/[0.06] hover:border-cream/45"}`}>
              <span className="text-4xl">{(side === "a" ? q.q.aEmoji : q.q.bEmoji) ?? (side === "a" ? "🅰️" : "🅱️")}</span>
              <span className="text-[15px] font-semibold leading-snug text-cream-50">{side === "a" ? q.q.a : q.q.b}</span>
            </motion.button>
          </Fragment>
        ))}
      </div>
      {picked && !react && <Busy label="Mate is reacting…" />}
      {react && (
        <Card>
          <div className="flex items-center gap-2"><SourceTag source={react.source} /></div>
          <p className="mt-1.5 text-[15px] text-cream-50">{react.r.reaction}</p>
          {react.r.followUp && <p className="mt-1 text-sm text-cream/75">{react.r.followUp}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <NextButton api={api} onClick={load}><RefreshCw className="h-4 w-4" /> Another one</NextButton>
            {react.r.followUp && <button onClick={() => api.openChat(`${react.r.reaction} ${react.r.followUp}`)} className="rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-cream/25 hover:bg-cream/10">Talk about it 💬</button>}
          </div>
        </Card>
      )}
      {!picked && <button onClick={() => api.canStartNew && load()} className="self-start text-xs font-semibold text-cream/55 hover:text-cream/85">Skip this one →</button>}
    </div>
  );
}

// ---------------------------------------------------------------- 04 · Cooking Jokes

export function JokesGame({ api }: { api: ChillApi }) {
  const [j, setJ] = useState<{ j: Joke; source: ChillSource } | null>(null);
  const [punch, setPunch] = useState(false);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reveal = useCallback((joke: Joke) => {
    setPunch(true); api.orb("celebrate");
    api.say(joke.punchline, { pitch: 1.12 });
    api.record({ type: "round" });
  }, [api]);

  const load = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    setLoading(true); setPunch(false); api.orb("thinking");
    const r = await api.fetchAi<Joke>({ activity: "jokes", recent: api.recent() });
    const item = r ? { j: r.data, source: "ai" as const } : { j: libraryJoke(api.recent()), source: "library" as const };
    api.remember(item.source === "ai" ? item.j.setup : item.j.id);
    setJ(item); setLoading(false); api.orb("talking");
    api.say(item.j.setup);
  }, [api]);
  useFirstLoad(load);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  useVoice(api, (_t, cmd) => {
    if (cmd === "next" && api.canStartNew) return void load();
    if (cmd === "repeat" && j) return api.say(punch ? `${j.j.setup} ${j.j.punchline}` : j.j.setup);
    if (j && !punch) reveal(j.j); // "why?", "tell me", "I don't know"…
  });

  if (loading || !j) return <Busy label="Warming up a joke…" />;
  return (
    <Card className="text-center">
      <div className="flex justify-center gap-2"><SourceTag source={j.source} /><span className="rounded-full bg-cream/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-cream/70">{j.j.category}</span></div>
      <p className="mx-auto mt-3 max-w-md font-display text-2xl leading-snug text-cream-50">{j.j.setup}</p>
      <AnimatePresence mode="wait">
        {punch ? (
          <motion.p key="p" initial={{ opacity: 0, scale: 0.8, rotate: -3 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 300, damping: 14 }} className="mx-auto mt-4 max-w-md rounded-2xl bg-cream px-4 py-3 text-lg font-bold text-burgundy">{j.j.punchline} 😄</motion.p>
        ) : (
          <motion.button key="b" onClick={() => reveal(j.j)} className="mt-4 rounded-full px-5 py-2 text-sm font-bold ring-1 ring-cream/30 hover:bg-cream/10" whileTap={{ scale: 0.95 }}>Tell me! 🥁</motion.button>
        )}
      </AnimatePresence>
      {punch && <div className="mt-4 flex justify-center"><NextButton api={api} onClick={load}><RefreshCw className="h-4 w-4" /> Another joke</NextButton></div>}
    </Card>
  );
}

// ---------------------------------------------------------------- 05 · Food Facts (curated library only)

function pickFact(ingredientIds: string[], cuisine: string, recent: string[]): { fact: Fact; related: string | null } {
  const keys = new Set([...ingredientIds, cuisine]);
  const fresh = FACTS.filter((f) => !recent.includes(f.id));
  const pool = fresh.length ? fresh : FACTS;
  const related = pool.filter((f) => f.tags.some((t) => keys.has(t)));
  const from = related.length ? related : pool;
  const fact = from[Math.floor(Math.random() * from.length)];
  const hit = fact.tags.find((t) => keys.has(t)) ?? null;
  return { fact, related: related.length ? hit : null };
}

export function FactsGame({ api, ingredientName }: { api: ChillApi; ingredientName: (id: string) => string }) {
  const [f, setF] = useState<{ fact: Fact; related: string | null } | null>(null);
  const load = useCallback(() => {
    const next = pickFact(api.ingredientIds, api.ctx.cuisine, api.recent());
    api.remember(next.fact.id);
    setF(next);
    api.record({ type: "round" });
    api.orb("talking");
    api.say(`${next.fact.title}. ${next.fact.fact}`);
  }, [api]);
  useFirstLoad(load);
  useVoice(api, (_t, cmd) => {
    if (cmd === "next" && api.canStartNew) load();
    if (cmd === "repeat" && f) api.say(f.fact.fact);
  });
  if (!f) return <Busy />;
  return (
    <AnimatePresence mode="wait">
      <motion.div key={f.fact.id} initial={{ opacity: 0, rotateX: -12, y: 12 }} animate={{ opacity: 1, rotateX: 0, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.45 }} style={{ transformPerspective: 800 }} className="glass-sheen relative overflow-hidden rounded-[1.75rem] border border-cream/20 bg-gradient-to-br from-cream/[0.14] to-cream/[0.03] p-5">
        <span className="pointer-events-none absolute -right-6 -top-6 text-[7rem] opacity-[0.12]" aria-hidden>{f.fact.emoji}</span>
        <div className="relative">
          <div className="flex flex-wrap items-center gap-2">
            <SourceTag source="library" />
            {f.related && <span className="rounded-full bg-burgundy/60 px-2 py-0.5 text-[10px] font-bold text-cream-50">In your recipe: {ingredientName(f.related)}</span>}
          </div>
          <p className="mt-3 text-3xl" aria-hidden>{f.fact.emoji}</p>
          <p className="mt-1 font-display text-2xl text-cream-50">{f.fact.title}</p>
          <p className="mt-2 text-[15px] leading-relaxed text-cream/90">{f.fact.fact}</p>
          <p className="mt-3 text-[11px] text-cream/50">Source: {f.fact.source}</p>
          <div className="mt-4"><NextButton api={api} onClick={load}><Lightbulb className="h-4 w-4" /> Another fact</NextButton></div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------- 06 · Mini Riddles

export function RiddleGame({ api }: { api: ChillApi }) {
  const [level, setLevel] = useState<Level>("easy");
  const [r, setR] = useState<{ q: Riddle; source: ChillSource } | null>(null);
  const [hinted, setHinted] = useState(false);
  const [status, setStatus] = useState<"playing" | "solved" | "revealed">("playing");
  const [miss, setMiss] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const lvl = useRef(level);
  lvl.current = level;

  const load = useCallback(async () => {
    setLoading(true); setHinted(false); setStatus("playing"); setMiss(null); api.orb("thinking");
    const res = await api.fetchAi<Riddle>({ activity: "riddles", difficulty: lvl.current, recent: api.recent() });
    const item = res ? { q: res.data, source: "ai" as const } : { q: libraryRiddle(lvl.current, api.recent()), source: "library" as const };
    api.remember(item.source === "ai" ? item.q.riddle : item.q.id);
    setR(item); setLoading(false); api.orb("idle");
    api.say(`Riddle time! ${item.q.riddle}`);
  }, [api]);
  useFirstLoad(load);

  const hint = () => { if (r && !hinted) { setHinted(true); api.say(`Hint: ${r.q.hint}`); } };
  const reveal = () => { if (!r) return; setStatus("revealed"); api.record({ type: "riddle", solved: false, hints: hinted ? 1 : 0 }); api.say(`It's ${r.q.answer}!`); };
  const guess = (t: string) => {
    if (!r || status !== "playing") return;
    if (isMatch(t, r.q.aliases)) {
      setStatus("solved"); api.orb("celebrate");
      api.record({ type: "riddle", solved: true, hints: hinted ? 1 : 0 });
      api.say(["Brilliant!", "Nailed it!", "Sharp as a chef's knife!"][Math.floor(Math.random() * 3)] + ` It's ${r.q.answer}.`);
    } else { setMiss(t); api.orb("oops"); api.say(hinted ? "Not quite! Try again, or say 'I give up'." : "Not quite! Want a hint?"); }
  };
  useVoice(api, (t, cmd) => {
    if (cmd === "hint") return hint();
    if (cmd === "reveal") return reveal();
    if (cmd === "next" && status !== "playing" && api.canStartNew) return void load();
    if (cmd === "repeat" && r) return api.say(r.q.riddle);
    if (!cmd) guess(t);
  });

  return (
    <div className="flex flex-col gap-3">
      <LevelPicker value={level} onChange={setLevel} />
      {loading || !r ? <Busy label="Thinking of a riddle…" /> : (
        <Card>
          <div className="flex items-center gap-2"><SourceTag source={r.source} /><span className="text-[10px] font-bold uppercase tracking-widest text-cream/50">{r.q.difficulty}</span></div>
          <p className="mt-2 font-display text-xl leading-snug text-cream-50">🧩 {r.q.riddle}</p>
          {hinted && status === "playing" && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2 rounded-xl bg-cream/10 px-3 py-2 text-sm text-cream/85">💡 {r.q.hint}</motion.p>}
          {status === "playing" ? (
            <>
              <AnswerBox api={api} onSubmit={guess} placeholder="What am I?" />
              {miss && <p className="mt-2 text-xs text-cream/70">“{miss}” — not quite!</p>}
              <div className="mt-3 flex gap-2">
                <button onClick={hint} disabled={hinted} className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ring-1 ring-cream/25 hover:bg-cream/10 disabled:opacity-40"><Lightbulb className="h-3.5 w-3.5" /> Hint</button>
                <button onClick={reveal} className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-cream/70 hover:bg-cream/10"><Eye className="h-3.5 w-3.5" /> Reveal answer</button>
              </div>
            </>
          ) : (
            <div className="mt-3">
              <p className="font-display text-2xl text-cream-50">{status === "solved" ? "🎉 " : ""}{r.q.answer}</p>
              <div className="mt-3"><NextButton api={api} onClick={load}><RefreshCw className="h-4 w-4" /> Next riddle</NextButton></div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- 07 · Fun Conversations

export function ChatGame({ api }: { api: ChillApi }) {
  const { msgs, setMsgs } = api.chat;
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useFirstLoad(useCallback(() => {
    if (!msgs.length) {
      const opener = CHAT_STARTERS[Math.floor(Math.random() * CHAT_STARTERS.length)];
      setMsgs(() => [{ who: "mate", text: `While that cooks — ${opener.charAt(0).toLowerCase()}${opener.slice(1)}`, source: "library" }]);
      api.say(opener);
    }
  }, [api, msgs.length, setMsgs]));
  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }); }, [msgs, busy]);

  const send = async (text: string) => {
    if (busy) return;
    const next: ChatMsg[] = [...msgs, { who: "user", text }];
    setMsgs(() => next);
    setBusy(true); api.orb("thinking");
    const r = await api.fetchAi<ChatReply>({ activity: "chat", messages: next.map((m) => ({ who: m.who, text: m.text })) });
    const userTurns = next.filter((m) => m.who === "user").length;
    const reply = r ? { ...r.data, source: "ai" as const } : { ...libraryChat(text, userTurns - 1), source: "library" as const };
    setMsgs((m) => [...m, { who: "mate", text: reply.reply, source: reply.source, cooking: reply.cookingQuestion || COOKING_Q.test(text) }]);
    setBusy(false); api.orb("idle");
    if (userTurns === 1) api.record({ type: "round" });
    api.say(reply.reply);
  };
  useVoice(api, (t, cmd) => { if (!cmd || cmd === "next") void send(t); });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={listRef} className="no-scrollbar flex max-h-[42svh] min-h-[160px] flex-1 flex-col gap-2.5 overflow-y-auto pr-1 lg:max-h-none" aria-live="polite">
        {msgs.map((m, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`max-w-[88%] rounded-3xl px-4 py-2.5 text-[14px] leading-relaxed ${m.who === "user" ? "ml-auto rounded-br-md bg-cream text-forest" : "rounded-bl-md bg-cream/10 text-cream-50 ring-1 ring-cream/10"}`}>
            {m.text}
            {m.who === "mate" && m.source && <span className="ml-2 inline-block translate-y-[-1px]"><SourceTag source={m.source} /></span>}
            {m.who === "mate" && m.cooking && (
              <button onClick={api.askCookingMate} className="mt-2 flex items-center gap-1.5 rounded-full bg-cream px-3 py-1 text-[12px] font-bold text-burgundy"><ChefHat className="h-3.5 w-3.5" /> Ask Cooking Mate</button>
            )}
          </motion.div>
        ))}
        {busy && <div className="flex w-16 gap-1 rounded-3xl bg-cream/10 px-4 py-3">{[0, 1, 2].map((d) => <motion.span key={d} className="h-2 w-2 rounded-full bg-cream/60" animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.8, delay: d * 0.15 }} />)}</div>}
      </div>
      <AnswerBox api={api} onSubmit={send} placeholder="Say anything…" disabled={busy} />
    </div>
  );
}

// ---------------------------------------------------------------- 08 · Short Interactive Stories

const STORY_PROMPTS = ["A potato who wants to become a chef", "A tomato's journey from farm to kitchen", "A magical restaurant that appears at midnight", "The mystery of a missing ingredient", "Two rival chefs and one tiny kitchen"];

export function StoryGame({ api }: { api: ChillApi }) {
  const [beats, setBeats] = useState<(StoryBeat & { choice?: string; source: ChillSource })[]>([]);
  const [lib, setLib] = useState<{ id: string; node: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [custom, setCustom] = useState("");
  const [narrate, setNarrate] = useState(true);
  const maxBeats = useRef(3);
  const prompt = useRef("");
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }); }, [beats, busy]);

  const tell = (b: StoryBeat) => { if (narrate) api.say(`${b.text}${b.choices.length ? ` Should we ${b.choices[0].toLowerCase()}, or ${b.choices[1].toLowerCase()}?` : ""}`, { rate: 0.97 }); };

  const libBeat = (storyId: string, nodeId: string): StoryBeat => {
    const st = STORIES.find((s) => s.id === storyId)!;
    const n = st.nodes[nodeId];
    return { title: st.title, text: n.text, choices: (n.choices ?? []).map((c) => c.label), ending: !n.choices?.length };
  };

  const startLibrary = (storyId: string) => {
    const st = STORIES.find((s) => s.id === storyId)!;
    setLib({ id: storyId, node: st.start });
    const b = libBeat(storyId, st.start);
    setBeats([{ ...b, source: "library" }]); tell(b);
  };

  const start = async (p: string) => {
    if (!api.canStartNew) return;
    prompt.current = p; maxBeats.current = storyBeatsFor(api.remaining);
    setBusy(true); api.orb("thinking");
    const r = await api.fetchAi<StoryBeat>({ activity: "story", prompt: p, beats: [], maxBeats: maxBeats.current });
    setBusy(false); api.orb("talking");
    if (r) { setLib(null); setBeats([{ ...r.data, source: "ai" }]); tell(r.data); }
    else startLibrary(/potato|chef/i.test(p) ? "s-potato" : /myster|missing/i.test(p) ? "s-jeera" : STORIES[Math.floor(Math.random() * STORIES.length)].id);
  };

  const choose = async (choice: string) => {
    if (busy) return;
    const marked = beats.map((b, i) => (i === beats.length - 1 ? { ...b, choice } : b));
    setBeats(marked);
    if (lib) {
      const st = STORIES.find((s) => s.id === lib.id)!;
      const next = st.nodes[lib.node].choices?.find((c) => c.label === choice)?.next;
      if (!next) return;
      setLib({ id: lib.id, node: next });
      const b = libBeat(lib.id, next);
      setBeats([...marked, { ...b, source: "library" }]); tell(b);
      if (b.ending) { api.record({ type: "story" }); api.orb("celebrate"); }
      return;
    }
    setBusy(true); api.orb("thinking");
    const r = await api.fetchAi<StoryBeat>({ activity: "story", prompt: prompt.current, beats: marked.map((b) => ({ text: b.text, choice: b.choice })), maxBeats: maxBeats.current });
    setBusy(false);
    // if the AI drops out mid-story, end it gracefully rather than leaving the user hanging
    const b: StoryBeat = r?.data ?? { title: marked[0].title, text: `And so, after choosing to ${choice.toLowerCase()}, our hero found exactly what they were looking for — and a delicious smell drifting from the kitchen. The end.`, choices: [], ending: true };
    setBeats([...marked, { ...b, source: r ? "ai" : "library" }]); tell(b);
    if (b.ending) { api.record({ type: "story" }); api.orb("celebrate"); } else api.orb("idle");
  };

  const last = beats[beats.length - 1];
  useVoice(api, (t, cmd) => {
    if (cmd === "repeat" && last) return tell(last);
    if (!beats.length && !cmd) return void start(t);
    if (last && !last.ending && !last.choice) { const i = pickOption(t, last.choices); if (i !== null) void choose(last.choices[i]); }
  });

  if (!beats.length) {
    return busy ? <Busy label="Opening the storybook…" /> : (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-cream/80">Pick a story — you'll choose what happens next. It ends before your timer does.</p>
        <div className="flex flex-wrap gap-2">
          {STORY_PROMPTS.map((p) => <button key={p} onClick={() => start(p)} disabled={!api.canStartNew} className="rounded-full border border-cream/20 bg-cream/5 px-3.5 py-2 text-left text-[13px] font-semibold text-cream-50 transition hover:border-cream/45 hover:bg-cream/10 disabled:opacity-40">{p}</button>)}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); if (custom.trim()) void start(custom.trim()); }} className="flex items-center gap-2 rounded-full bg-cream/10 p-1.5 pl-4 ring-1 ring-cream/15">
          <input value={custom} onChange={(e) => setCustom(e.target.value.slice(0, 120))} placeholder="…or your own idea" className="min-w-0 flex-1 bg-transparent text-sm text-cream-50 outline-none placeholder:text-cream/45" aria-label="Your story idea" />
          <button type="submit" disabled={!custom.trim() || !api.canStartNew} className="flex h-9 items-center gap-1 rounded-full bg-burgundy px-3 text-xs font-bold text-cream-50 disabled:opacity-40"><BookOpen className="h-3.5 w-3.5" /> Start</button>
        </form>
      </div>
    );
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate font-display text-lg text-cream-50">📖 {beats[0].title}</p>
        <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-[11px] font-semibold text-cream/70"><input type="checkbox" checked={narrate} onChange={(e) => { setNarrate(e.target.checked); if (!e.target.checked) api.stopVoice(); }} className="accent-[#F5DABF]" /> Narrate</label>
      </div>
      <div ref={listRef} className="no-scrollbar flex max-h-[40svh] flex-col gap-3 overflow-y-auto lg:max-h-[46vh]">
        {beats.map((b, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <p className="text-[15px] leading-relaxed text-cream/95">{b.text} <SourceTag source={b.source} /></p>
            {b.choice && <p className="mt-1.5 text-xs font-semibold text-cream/55">→ You chose: {b.choice}</p>}
          </motion.div>
        ))}
        {busy && <Busy label="Turning the page…" />}
      </div>
      {last && !last.ending && !last.choice && !busy && (
        <div className="grid gap-2 sm:grid-cols-2">
          {last.choices.map((c) => <motion.button key={c} onClick={() => choose(c)} whileTap={{ scale: 0.97 }} className="rounded-2xl border border-cream/25 bg-cream/[0.07] px-3 py-2.5 text-left text-sm font-semibold text-cream-50 hover:border-cream/50 hover:bg-cream/15">{c}</motion.button>)}
        </div>
      )}
      {last?.ending && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-display text-lg text-cream">✨ The End</span>
          <NextButton api={api} onClick={() => { setBeats([]); setLib(null); }}><BookOpen className="h-4 w-4" /> Another story</NextButton>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- 09 · Singing Activities

const SONG_TOPICS: { label: string; topic: string; style: string }[] = [
  { label: "🥔 Funny potato song", topic: "a potato who loves to dance", style: "jingle" },
  { label: "🥕 Vegetable dance jingle", topic: "vegetables having a dance party in the pan", style: "jingle" },
  { label: "⏲️ Cooking timer song", topic: "waiting for the cooking timer", style: "timer song" },
  { label: "🍲 Song about my recipe", topic: "", style: "celebration" },
  { label: "🧺 My ingredients' song", topic: "my ingredients", style: "jingle" },
  { label: "🎤 Chef rap", topic: "being the coolest chef in the kitchen", style: "chef rap" },
  { label: "🎉 Kitchen celebration", topic: "a little celebration in the kitchen", style: "celebration" },
];

export function SongGame({ api }: { api: ChillApi }) {
  const [song, setSong] = useState<{ s: Song; source: ChillSource } | null>(null);
  const [busy, setBusy] = useState(false);
  const [custom, setCustom] = useState("");

  const write = async (topic: string, style: string) => {
    if (!api.canStartNew) return;
    setBusy(true); api.orb("thinking");
    const r = await api.fetchAi<Song>({ activity: "song", topic: topic || api.ctx.recipeName, style });
    const item = r ? { s: r.data, source: "ai" as const } : { s: librarySong(style, api.ctx.recipeName, api.ctx.ingredients), source: "library" as const };
    setSong(item); setBusy(false); api.orb("celebrate");
    api.record({ type: "song" });
  };
  const perform = () => { if (song) { api.orb("talking"); api.say(`${song.s.title}! ${song.s.lines.join(". ")}`, { rate: 1.05, pitch: 1.15 }); } };

  useVoice(api, (t, cmd) => {
    if (cmd === "repeat" || /^(sing|perform|play)/i.test(t)) return perform();
    if (!song && !cmd) void write(t, "jingle");
  });

  if (busy) return <Busy label="Mate is writing lyrics…" />;
  if (!song) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-cream/80">Pick a song and Mate will write original lyrics for you — just for this kitchen.</p>
        <div className="flex flex-wrap gap-2">
          {SONG_TOPICS.map((t) => <button key={t.label} onClick={() => write(t.topic, t.style)} disabled={!api.canStartNew} className="rounded-full border border-cream/20 bg-cream/5 px-3.5 py-2 text-[13px] font-semibold text-cream-50 transition hover:border-cream/45 hover:bg-cream/10 disabled:opacity-40">{t.label}</button>)}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); if (custom.trim()) void write(custom.trim(), "jingle"); }} className="flex items-center gap-2 rounded-full bg-cream/10 p-1.5 pl-4 ring-1 ring-cream/15">
          <input value={custom} onChange={(e) => setCustom(e.target.value.slice(0, 120))} placeholder="…or a song about anything" className="min-w-0 flex-1 bg-transparent text-sm text-cream-50 outline-none placeholder:text-cream/45" aria-label="Song topic" />
          <button type="submit" disabled={!custom.trim() || !api.canStartNew} className="h-9 rounded-full bg-burgundy px-3 text-xs font-bold text-cream-50 disabled:opacity-40">Write it</button>
        </form>
      </div>
    );
  }
  return (
    <Card>
      <div className="flex items-center gap-2"><SourceTag source={song.source} /><span className="rounded-full bg-cream/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-cream/70">{song.s.style}</span></div>
      <p className="mt-2 font-display text-2xl text-cream-50">🎵 {song.s.title}</p>
      <div className="mt-3 space-y-1">
        {song.s.lines.map((l, i) => (
          <motion.p key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0, y: api.speaking ? [0, -2, 0] : 0 }} transition={{ delay: i * 0.12, y: { duration: 0.6, repeat: api.speaking ? Infinity : 0, delay: i * 0.08 } }} className="font-display text-lg italic leading-snug text-cream/95">{l}</motion.p>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {api.speaking ? (
          <button onClick={api.stopVoice} className="flex items-center gap-1.5 rounded-full bg-cream px-4 py-2 text-sm font-bold text-burgundy"><Square className="h-3.5 w-3.5 fill-burgundy" /> Stop</button>
        ) : (
          <button onClick={perform} className="flex items-center gap-1.5 rounded-full bg-cream px-4 py-2 text-sm font-bold text-burgundy"><Play className="h-4 w-4" /> Mate, perform it!</button>
        )}
        <button onClick={() => { api.stopVoice(); setSong(null); }} disabled={!api.canStartNew} className="flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-cream/25 hover:bg-cream/10 disabled:opacity-40"><RefreshCw className="h-4 w-4" /> New song</button>
        <button onClick={() => { api.stopVoice(); setSong(null); }} className="flex items-center gap-1 rounded-full px-3 py-2 text-xs font-semibold text-cream/60 hover:text-cream"><X className="h-3.5 w-3.5" /> Skip</button>
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-cream/50">Original lyrics. Mate performs them with its speaking voice — RANNAMATE doesn&apos;t generate music or melodies.</p>
    </Card>
  );
}

