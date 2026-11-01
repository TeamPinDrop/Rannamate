"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { motion, useMotionValueEvent, useScroll, useTransform, type MotionValue } from "framer-motion";
import { ArrowRight, Check, Clock, Flame } from "lucide-react";

/**
 * Signature scroll scene: an empty glass bowl fills as the user scrolls.
 * Ingredients drop in one by one, the broth rises and deepens in colour,
 * a spoon stirs, steam appears and the bowl becomes a finished recipe.
 * Everything is a pure function of scroll progress, so it scrubs both ways.
 */

// ---- geometry (SVG units == px inside a 440×340 stage) ----
const W = 440;
const CX = 220;
const RIM_Y = 130;
const BOTTOM_Y = 312;
const HALF = 192;
const EMPTY_Y = 300;
const FULL_Y = 168;

const FILL_START = 0.1;
const FILL_END = 0.62;

const ITEMS = [
  { e: "🍅", name: "Tomatoes", from: -170, dx: -70 },
  { e: "🧅", name: "Onion", from: 150, dx: 60 },
  { e: "🌶️", name: "Green chilli", from: -60, dx: -15 },
  { e: "🧄", name: "Garlic", from: 190, dx: 105 },
  { e: "🥔", name: "Potatoes", from: -200, dx: -110 },
  { e: "🥚", name: "Eggs", from: 80, dx: 30 },
  { e: "🫑", name: "Bell pepper", from: -120, dx: 80 },
  { e: "🍄", name: "Mushrooms", from: 30, dx: -55 },
];
const N = ITEMS.length;
const SLOT = (FILL_END - FILL_START) / N;
const landAt = (i: number) => FILL_START + SLOT * (i + 0.85);

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeOut = (t: number) => 1 - Math.pow(1 - clamp(t), 3);
const easeIn = (t: number) => Math.pow(clamp(t), 2);

/** height of the broth surface for a given scroll progress */
const surfaceY = (p: number) => lerp(EMPTY_Y, FULL_Y, easeOut((p - FILL_START) / (FILL_END - FILL_START + 0.05)));
/** half-width of the bowl interior at a given y */
const halfWidthAt = (y: number) => HALF * Math.sqrt(clamp(1 - Math.pow((y - RIM_Y) / (BOTTOM_Y - RIM_Y), 2)));

const STAGES = [
  { from: 0, to: 0.1, eyebrow: "An empty bowl", title: "Endless possibilities.", body: "Every great meal starts with nothing but what's already in your kitchen." },
  { from: 0.1, to: 0.62, eyebrow: "Add what you have", title: "Toss in your ingredients.", body: "Tomatoes, an onion, a few eggs — tell RANNAMATE what's around and it starts thinking." },
  { from: 0.62, to: 0.8, eyebrow: "Let it simmer", title: "RANNAMATE stirs it together.", body: "It matches ingredients, mood, time and diet against every recipe it knows." },
  { from: 0.8, to: 1.01, eyebrow: "Dinner, discovered", title: "Something amazing, ready to cook.", body: "A recipe you can actually make right now — with a Cooking Mate to talk you through it." },
];

function Falling({ i, p }: { i: number; p: MotionValue<number> }) {
  const it = ITEMS[i];
  const start = FILL_START + SLOT * i;
  const land = landAt(i);
  const restDx = it.dx * 0.62;

  const x = useTransform(p, (v) => {
    if (v < land) return CX + lerp(it.from, it.dx, easeOut((v - start) / (land - start)));
    const y = surfaceY(v) - 6;
    const hw = halfWidthAt(y) - 26;
    return CX + clamp(restDx, -hw, hw) + Math.sin(v * 40 + i) * 3;
  });
  const y = useTransform(p, (v) => {
    if (v < land) return lerp(-260, surfaceY(land) - 6, easeIn((v - start) / (land - start)));
    const stir = v > 0.62 && v < 0.8 ? Math.sin((v - 0.62) * 60 + i) * 6 : 0;
    return surfaceY(v) - 6 + stir;
  });
  const rotate = useTransform(p, [start, land, 1], [i % 2 ? -120 : 140, 0, i % 2 ? 40 : -30]);
  const scale = useTransform(p, [start, land, land + 0.02, 0.85], [1.15, 1, 0.62, 0.55]);
  const opacity = useTransform(p, [start - 0.01, start, 0.86, 0.9], [0, 1, 1, 0]);

  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute left-0 top-0 -ml-6 -mt-6 flex h-12 w-12 items-center justify-center text-[42px] drop-shadow-[0_10px_10px_rgba(46,7,12,0.3)]"
      style={{ x, y, rotate, scale, opacity }}
    >
      {it.e}
    </motion.div>
  );
}

function Splash({ i, p }: { i: number; p: MotionValue<number> }) {
  const land = landAt(i);
  const r = useTransform(p, [land - 0.002, land + 0.03], [6, 54]);
  const opacity = useTransform(p, [land - 0.002, land, land + 0.03], [0, 0.85, 0]);
  const ry = useTransform(r, (v) => v * 0.28);
  return <motion.ellipse cx={CX + ITEMS[i].dx * 0.62} cy={surfaceY(land)} rx={r} ry={ry} fill="none" stroke="#FFF7EC" strokeWidth={2.5} style={{ opacity }} />;
}

function Bowl({ p }: { p: MotionValue<number> }) {
  const liquidY = useTransform(p, surfaceY);
  const liquidRx = useTransform(liquidY, (y) => halfWidthAt(y));
  const liquidRy = useTransform(liquidRx, (rx) => rx * 0.17);
  const liquidOpacity = useTransform(p, [FILL_START, FILL_START + 0.03], [0, 1]);
  const colorA = useTransform(p, [FILL_START, 0.4, FILL_END, 0.85], ["#F7D6A6", "#F0A35A", "#D9692D", "#B9481F"]);
  const colorB = useTransform(p, [FILL_START, 0.4, FILL_END, 0.85], ["#EFC08A", "#DE7B3A", "#B7461E", "#8E2A16"]);
  const sheen = useTransform(p, [0.62, 0.8], [0.15, 0.45]);
  const swirl = useTransform(p, [0.62, 0.8], [0, 720]);
  const swirlOpacity = useTransform(p, [0.6, 0.64, 0.78, 0.82], [0, 0.55, 0.55, 0]);
  const glow = useTransform(p, [0.8, 0.95], [0, 0.9]);
  const sheenRx = useTransform(liquidRx, (r) => r * 0.55);
  const sheenRy = useTransform(liquidRy, (r) => r * 0.4);
  const emptyHint = useTransform(p, [0, 0.07, 0.1], [1, 1, 0]);

  return (
    <svg viewBox={`0 0 ${W} 340`} className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
      <defs>
        <clipPath id="bowl-inside">
          <path d={`M${CX - HALF} ${RIM_Y} C${CX - HALF} 250 ${CX - 110} ${BOTTOM_Y} ${CX} ${BOTTOM_Y} C${CX + 110} ${BOTTOM_Y} ${CX + HALF} 250 ${CX + HALF} ${RIM_Y} Z`} />
        </clipPath>
        <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.55" />
          <stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0.14" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0.32" />
        </linearGradient>
        <motion.linearGradient id="broth" x1="0" y1="0" x2="0" y2="1">
          <motion.stop offset="0" stopColor={colorA} />
          <motion.stop offset="1" stopColor={colorB} />
        </motion.linearGradient>
        <radialGradient id="warm" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#F2B33D" stopOpacity="0.8" />
          <stop offset="1" stopColor="#F2B33D" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* warm glow when the dish is ready */}
      <motion.ellipse cx={CX} cy={210} rx={260} ry={170} fill="url(#warm)" style={{ opacity: glow }} />
      {/* table shadow */}
      <ellipse cx={CX} cy={326} rx={170} ry={14} fill="#2E070C" opacity={0.18} />

      {/* back rim (inside of bowl) */}
      <ellipse cx={CX} cy={RIM_Y} rx={HALF} ry={32} fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.6)" strokeWidth={1.5} />

      {/* broth */}
      <g clipPath="url(#bowl-inside)">
        <motion.rect x={CX - HALF} width={HALF * 2} height={260} y={liquidY} fill="url(#broth)" style={{ opacity: liquidOpacity }} />
        <motion.ellipse cx={CX} cy={liquidY} rx={liquidRx} ry={liquidRy} fill={colorA} style={{ opacity: liquidOpacity }} />
        <motion.ellipse cx={CX - 30} cy={liquidY} rx={sheenRx} ry={sheenRy} fill="#FFF" style={{ opacity: sheen }} />
        {/* stir swirl */}
        <motion.g style={{ rotate: swirl, opacity: swirlOpacity, originX: `${CX}px`, originY: "190px" }}>
          <motion.path d={`M${CX - 70} 190 Q${CX} 160 ${CX + 70} 190 Q${CX} 214 ${CX - 40} 192`} stroke="#FFF2DE" strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.8} />
        </motion.g>
      </g>

      {ITEMS.map((_, i) => <Splash key={i} i={i} p={p} />)}

      {/* empty-bowl hint */}
      <motion.g style={{ opacity: emptyHint }}>
        <text x={CX} y={238} textAnchor="middle" fontFamily="Fraunces, Georgia, serif" fontStyle="italic" fontSize="22" fill="#6C151E" opacity={0.75}>
          What&apos;s in your kitchen?
        </text>
      </motion.g>

      {/* glass body */}
      <path
        d={`M${CX - HALF} ${RIM_Y} C${CX - HALF} 250 ${CX - 110} ${BOTTOM_Y} ${CX} ${BOTTOM_Y} C${CX + 110} ${BOTTOM_Y} ${CX + HALF} 250 ${CX + HALF} ${RIM_Y}`}
        fill="url(#glass)"
        stroke="rgba(255,255,255,0.85)"
        strokeWidth={2}
      />
      {/* reflections */}
      <path d={`M${CX - 160} 170 C${CX - 150} 230 ${CX - 110} 270 ${CX - 60} 288`} stroke="rgba(255,255,255,0.75)" strokeWidth={6} strokeLinecap="round" fill="none" />
      <path d={`M${CX + 150} 180 C${CX + 140} 215 ${CX + 125} 238 ${CX + 105} 255`} stroke="rgba(255,255,255,0.45)" strokeWidth={3} strokeLinecap="round" fill="none" />
      {/* front rim */}
      <path d={`M${CX - HALF} ${RIM_Y} A${HALF} 32 0 0 0 ${CX + HALF} ${RIM_Y}`} fill="none" stroke="rgba(255,255,255,0.95)" strokeWidth={3} />
      {/* foot */}
      <path d={`M${CX - 70} ${BOTTOM_Y - 2} L${CX - 80} 322 L${CX + 80} 322 L${CX + 70} ${BOTTOM_Y - 2}`} fill="rgba(255,255,255,0.3)" stroke="rgba(255,255,255,0.7)" strokeWidth={1.5} />
    </svg>
  );
}

function Spoon({ p }: { p: MotionValue<number> }) {
  const opacity = useTransform(p, [0.58, 0.63, 0.8, 0.84], [0, 1, 1, 0]);
  const y = useTransform(p, [0.58, 0.63], [-80, 0]);
  const rotate = useTransform(p, (v) => (v > 0.62 && v < 0.82 ? Math.sin((v - 0.62) * 45) * 26 : 0));
  return (
    <motion.div aria-hidden className="pointer-events-none absolute left-[56%] top-[-8%] h-[230px] w-10 origin-bottom" style={{ opacity, y, rotate }}>
      <svg viewBox="0 0 40 230" className="h-full w-full">
        <rect x="16" y="0" width="8" height="160" rx="4" fill="#7A4A2A" />
        <ellipse cx="20" cy="190" rx="18" ry="32" fill="#9A6036" />
        <ellipse cx="16" cy="182" rx="6" ry="14" fill="#C08452" opacity="0.7" />
      </svg>
    </motion.div>
  );
}

function Steam({ p }: { p: MotionValue<number> }) {
  const opacity = useTransform(p, [0.74, 0.84], [0, 1]);
  return (
    <motion.div aria-hidden className="pointer-events-none absolute left-1/2 top-[-6%] flex -translate-x-1/2 gap-6" style={{ opacity }}>
      {[0, 1, 2].map((k) => (
        <motion.svg key={k} width="26" height="90" viewBox="0 0 26 90" animate={{ y: [8, -10, 8], opacity: [0.3, 0.85, 0.3] }} transition={{ duration: 3 + k * 0.5, repeat: Infinity, delay: k * 0.6, ease: "easeInOut" }}>
          <path d="M13 88 C2 70 24 58 13 42 C2 26 24 16 13 2" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" fill="none" opacity="0.85" />
        </motion.svg>
      ))}
    </motion.div>
  );
}

const LEAVES = [-60, -10, 45, 90, -100];

function Leaf({ k, p }: { k: number; p: MotionValue<number> }) {
  const s = 0.78 + k * 0.012;
  const y = useTransform(p, [s, s + 0.04], [-140, FULL_Y - 14 + (k % 2) * 8]);
  const opacity = useTransform(p, [s, s + 0.01], [0, 1]);
  const rotate = useTransform(p, [s, s + 0.04], [k * 70, k * 25 - 30]);
  return (
    <motion.span aria-hidden className="pointer-events-none absolute left-0 top-0 -ml-3 -mt-3 text-2xl" style={{ x: CX + LEAVES[k], y, opacity, rotate }}>
      🌿
    </motion.span>
  );
}

function StageText({ s, p }: { s: (typeof STAGES)[number]; p: MotionValue<number> }) {
  const a = Math.max(0, s.from - 0.02);
  const b = s.to + 0.02;
  const opacity = useTransform(p, s.from === 0 ? [0, b - 0.04, b] : [a, s.from + 0.02, s.to - 0.02, b], s.from === 0 ? [1, 1, 0] : [0, 1, 1, 0]);
  const y = useTransform(p, [a, s.from + 0.03], [24, 0]);
  return (
    <motion.div style={{ opacity, y }} className="absolute inset-0">
      <p className="eyebrow">{s.eyebrow}</p>
      <h2 className="h-display mt-3 text-3xl leading-[1.05] text-forest sm:text-4xl lg:text-5xl">{s.title}</h2>
      <p className="mt-4 max-w-sm text-forest/75">{s.body}</p>
    </motion.div>
  );
}

export function BowlStory() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress: p } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const [added, setAdded] = useState(0);
  const [done, setDone] = useState(false);
  useMotionValueEvent(p, "change", (v) => {
    const n = ITEMS.filter((_, i) => v >= landAt(i)).length;
    if (n !== added) setAdded(n);
    if (v > 0.84 !== done) setDone(v > 0.84);
  });

  const progressW = useTransform(p, [0, 1], ["0%", "100%"]);
  const cardOpacity = useTransform(p, [0.82, 0.9], [0, 1]);
  const cardY = useTransform(p, [0.82, 0.9], [30, 0]);
  const bowlScale = useTransform(p, [0, 0.08, 0.8, 0.92], [0.92, 1, 1, 1.04]);

  return (
    <section ref={ref} className="relative h-[340vh]" aria-label="From an empty bowl to a finished recipe">
      <div className="sticky top-0 flex h-[100svh] items-center overflow-hidden pt-20">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-[minmax(0,1fr)] items-center gap-6 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)_minmax(0,1fr)]">
          {/* left: story text */}
          <div className="relative order-1 h-[170px] lg:h-[260px]">
            {STAGES.map((s) => <StageText key={s.eyebrow} s={s} p={p} />)}
          </div>

          {/* centre: the bowl */}
          <div className="relative order-2 flex justify-center">
            <div className="relative h-[340px] w-[440px] shrink-0 scale-[0.7] max-sm:-my-12 sm:scale-100 xl:scale-[1.12]">
            <motion.div style={{ scale: bowlScale }} className="relative h-full w-full">
              <Steam p={p} />
              <Bowl p={p} />
              {ITEMS.map((_, i) => <Falling key={i} i={i} p={p} />)}
              {LEAVES.map((_, k) => <Leaf key={k} k={k} p={p} />)}
              <Spoon p={p} />
            </motion.div>
            </div>
          </div>

          {/* right: live ingredient list → recipe card */}
          <div className="relative order-3 hidden h-[340px] lg:block">
            <motion.div animate={{ opacity: done ? 0 : 1, y: done ? -20 : 0 }} className="glass glass-sheen absolute inset-x-0 top-0 rounded-[2rem] p-5">
              <div className="relative flex items-center justify-between">
                <p className="eyebrow">In the bowl</p>
                <span className="rounded-full bg-forest px-2.5 py-0.5 text-xs font-bold text-cream-50">{added}/{N}</span>
              </div>
              <ul className="relative mt-3 grid grid-cols-1 gap-1">
                {ITEMS.map((it, i) => {
                  const on = i < added;
                  return (
                    <li key={it.name} className={`flex items-center gap-2 rounded-xl px-2.5 py-1 text-[13px] font-semibold transition-all duration-300 ${on ? "bg-white/55 text-forest" : "text-forest/35"}`}>
                      <span className={`text-lg transition ${on ? "" : "grayscale"}`}>{it.e}</span>
                      <span className="flex-1 truncate">{it.name}</span>
                      {on && <Check className="h-3.5 w-3.5 text-[#1F6B4F]" />}
                    </li>
                  );
                })}
              </ul>
            </motion.div>

            <motion.div style={{ opacity: cardOpacity, y: cardY }} className="glass-strong glass-sheen absolute inset-x-0 top-0 rounded-[2rem] p-5" aria-hidden={!done}>
              <p className="relative eyebrow">Your match</p>
              <h3 className="relative mt-1 font-display text-3xl font-semibold text-forest">Shakshuka-style Egg Curry</h3>
              <div className="relative mt-3 flex flex-wrap gap-2 text-xs font-semibold text-forest/80">
                <span className="flex items-center gap-1 rounded-full bg-white/50 px-2.5 py-1"><Clock className="h-3.5 w-3.5" /> 25 min</span>
                <span className="flex items-center gap-1 rounded-full bg-white/50 px-2.5 py-1"><Flame className="h-3.5 w-3.5" /> Beginner</span>
                <span className="rounded-full bg-[#1F6B4F] px-2.5 py-1 text-cream-50">8/8 ingredients</span>
              </div>
              <p className="relative mt-3 text-sm text-forest/75">Eggs poached in a spiced tomato, onion and pepper sauce, finished with fresh herbs.</p>
              <Link href="/kitchen" tabIndex={done ? 0 : -1} className="btn-primary relative mt-4 w-full">Find my recipe <ArrowRight className="h-4 w-4" /></Link>
            </motion.div>
          </div>
        </div>

        <div className="absolute bottom-6 left-1/2 h-1 w-40 -translate-x-1/2 overflow-hidden rounded-full bg-forest/15">
          <motion.div style={{ width: progressW }} className="h-full bg-burgundy" />
        </div>
      </div>
    </section>
  );
}
