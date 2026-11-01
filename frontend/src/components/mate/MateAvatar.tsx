"use client";
import { useId } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Persona } from "@/lib/mate/types";

export type AvatarState = "idle" | "listening" | "thinking" | "talking";
export type AvatarMood = "happy" | "excited" | "thinking" | "neutral";

/** "Mate" — an animated chef character whose face reacts to what's happening. */
export function MateAvatar({ state, mood = "happy", persona, size = 220 }: { state: AvatarState; mood?: AvatarMood; persona: Persona; size?: number }) {
  const uid = useId().replace(/:/g, "");
  const faceId = `face-${uid}`;
  const hatId = `hat-${uid}`;
  const excited = mood === "excited" || persona === "chatpata";
  const eyeY = state === "thinking" ? 113 : 118;
  const eyeX = state === "thinking" ? 4 : 0;

  return (
    <div className="relative" style={{ width: size, height: size * 1.1 }}>
      {/* listening rings */}
      <AnimatePresence>
        {state === "listening" &&
          [0, 1, 2].map((k) => (
            <motion.span
              key={k}
              className="absolute left-1/2 top-[57%] rounded-full border-2 border-cream/60"
              style={{ width: size * 0.7, height: size * 0.7, marginLeft: -size * 0.35, marginTop: -size * 0.35 }}
              initial={{ scale: 0.8, opacity: 0.8 }}
              animate={{ scale: 1.7, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.8, repeat: Infinity, delay: k * 0.6, ease: "easeOut" }}
            />
          ))}
      </AnimatePresence>

      {/* thinking: orbiting ingredients */}
      <AnimatePresence>
        {state === "thinking" && (
          <motion.div className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1, rotate: 360 }} exit={{ opacity: 0 }} transition={{ rotate: { duration: 4, repeat: Infinity, ease: "linear" }, opacity: { duration: 0.3 } }}>
            {["🌶️", "🧄", "🍅", "🌿"].map((e, k) => (
              <span key={e} className="absolute text-2xl" style={{ left: `${50 + 46 * Math.cos((k * Math.PI) / 2)}%`, top: `${55 + 42 * Math.sin((k * Math.PI) / 2)}%`, transform: "translate(-50%,-50%)" }}>{e}</span>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* chatpata flames */}
      {persona === "chatpata" && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-between px-2">
          {[0, 1].map((k) => (
            <motion.span key={k} className="text-3xl" animate={{ y: [0, -10, 0], scale: [1, 1.15, 1], rotate: [k ? 8 : -8, k ? -4 : 4, k ? 8 : -8] }} transition={{ duration: 1.2 + k * 0.3, repeat: Infinity }}>
              🔥
            </motion.span>
          ))}
        </div>
      )}

      <motion.svg
        viewBox="0 0 200 220"
        className="relative h-full w-full drop-shadow-[0_30px_40px_rgba(0,0,0,0.35)]"
        animate={state === "talking" ? { y: [0, -3, 0, -2, 0] } : excited ? { y: [0, -6, 0], rotate: [0, -2, 2, 0] } : { y: [0, -4, 0] }}
        transition={{ duration: state === "talking" ? 0.6 : 3, repeat: Infinity, ease: "easeInOut" }}
        aria-hidden
      >
        <defs>
          <radialGradient id={faceId} cx="0.4" cy="0.35" r="0.75">
            <stop offset="0" stopColor="#FFF3E4" />
            <stop offset="1" stopColor="#F1C9A0" />
          </radialGradient>
          <linearGradient id={hatId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#FFFFFF" />
            <stop offset="1" stopColor="#EDE4DA" />
          </linearGradient>
        </defs>

        {/* scarf / body */}
        <path d="M52 182 Q100 230 148 182 L160 220 L40 220 Z" fill="#0F3D3A" />
        <path d="M74 176 L100 204 L126 176 Z" fill="#6C151E" />

        {/* face */}
        <circle cx="100" cy="125" r="62" fill={`url(#${faceId})`} />
        {/* ears */}
        <ellipse cx="38" cy="128" rx="8" ry="12" fill="#EFC49A" />
        <ellipse cx="162" cy="128" rx="8" ry="12" fill="#EFC49A" />

        {/* chef hat */}
        <motion.g animate={state === "talking" ? { rotate: [0, -2, 2, 0] } : {}} transition={{ duration: 0.8, repeat: Infinity }} style={{ originX: "100px", originY: "80px" }}>
          <circle cx="68" cy="50" r="26" fill={`url(#${hatId})`} />
          <circle cx="100" cy="36" r="31" fill={`url(#${hatId})`} />
          <circle cx="132" cy="50" r="26" fill={`url(#${hatId})`} />
          <rect x="62" y="52" width="76" height="30" rx="8" fill={`url(#${hatId})`} />
          <rect x="62" y="72" width="76" height="9" rx="4" fill="#E5D8CB" />
          {persona === "mild" && <text x="118" y="70" fontSize="16">🌿</text>}
          {persona === "masala" && <text x="116" y="70" fontSize="16">🌶️</text>}
          {persona === "chatpata" && <text x="114" y="70" fontSize="16">🔥</text>}
        </motion.g>

        {/* eyebrows */}
        <motion.path d="M68 100 Q78 94 88 100" stroke="#5A2A1A" strokeWidth="3.5" strokeLinecap="round" fill="none" animate={{ y: excited || state === "listening" ? -4 : state === "thinking" ? -2 : 0, rotate: state === "thinking" ? -6 : 0 }} />
        <motion.path d="M112 100 Q122 94 132 100" stroke="#5A2A1A" strokeWidth="3.5" strokeLinecap="round" fill="none" animate={{ y: excited || state === "listening" ? -4 : 0, rotate: state === "thinking" ? 6 : 0 }} />

        {/* eyes with blink */}
        {[78, 122].map((x) => (
          <motion.g key={x} animate={{ scaleY: [1, 1, 0.1, 1] }} transition={{ duration: 4, times: [0, 0.92, 0.95, 1], repeat: Infinity, delay: x === 78 ? 0 : 0.02 }} style={{ originX: `${x}px`, originY: "118px" }}>
            <motion.ellipse cx={x} rx={state === "listening" ? 8 : 7} ry={state === "listening" ? 10 : 9} fill="#2B1410" animate={{ cy: eyeY, cx: x + eyeX }} />
            <motion.circle r="2.6" fill="#fff" animate={{ cx: x + 2 + eyeX, cy: eyeY - 3 }} />
          </motion.g>
        ))}

        {/* cheeks */}
        <ellipse cx="62" cy="142" rx="11" ry="7" fill="#E8907F" opacity={excited ? 0.7 : 0.45} />
        <ellipse cx="138" cy="142" rx="11" ry="7" fill="#E8907F" opacity={excited ? 0.7 : 0.45} />

        {/* mustache for extra chatpata */}
        {persona === "chatpata" && (
          <motion.path d="M100 146 C88 138 74 140 70 150 C78 146 88 150 100 152 C112 150 122 146 130 150 C126 140 112 138 100 146 Z" fill="#3A1A10" animate={state === "talking" ? { y: [0, -1.5, 0] } : {}} transition={{ duration: 0.25, repeat: Infinity }} />
        )}

        {/* mouth */}
        {state === "talking" ? (
          <motion.ellipse cx="100" cy="160" rx="13" fill="#6C151E" animate={{ ry: [3, 9, 5, 10, 4] }} transition={{ duration: 0.55, repeat: Infinity }} />
        ) : state === "thinking" ? (
          <ellipse cx="108" cy="160" rx="6" ry="4.5" fill="#6C151E" />
        ) : state === "listening" ? (
          <ellipse cx="100" cy="160" rx="9" ry="6" fill="#6C151E" />
        ) : (
          <path d={excited ? "M80 153 Q100 176 120 153 Q100 162 80 153 Z" : "M84 155 Q100 168 116 155"} stroke="#6C151E" strokeWidth="4" strokeLinecap="round" fill={excited ? "#6C151E" : "none"} />
        )}
      </motion.svg>
    </div>
  );
}
