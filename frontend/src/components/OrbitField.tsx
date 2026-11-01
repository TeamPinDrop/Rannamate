"use client";
import { useEffect, useRef } from "react";

export interface OrbitItem {
  emoji: string;
  size?: number; // px
  ring?: number; // 0..1 relative radius multiplier
  phase?: number; // radians
}

interface Props {
  items: OrbitItem[];
  /** radius in px of the outer ring */
  radius: number;
  /** vertical squash for the 3D ellipse */
  tilt?: number;
  /** radians per second */
  speed?: number;
  /** returns 0 (full orbit) .. 1 (fully converged to centre) */
  getConverge?: () => number;
  /** pointer parallax strength in px */
  parallax?: number;
  className?: string;
  reduced?: boolean;
}

/**
 * Lightweight pseudo-3D orbit: ingredients travel an inclined ellipse; depth is
 * expressed through scale, blur, brightness and z-order. One rAF loop, no WebGL.
 */
export function OrbitField({ items, radius, tilt = 0.38, speed = 0.35, getConverge, parallax = 0, className = "", reduced }: Props) {
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  const pointer = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!parallax) return;
    const on = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth - 0.5) * 2;
      pointer.current.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("pointermove", on, { passive: true });
    return () => window.removeEventListener("pointermove", on);
  }, [parallax]);

  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const px = { x: 0, y: 0 };
    const frame = (now: number) => {
      const t = reduced ? 0 : (now - t0) / 1000;
      const conv = Math.min(1, Math.max(0, getConverge?.() ?? 0));
      const ease = 1 - Math.pow(1 - conv, 3);
      px.x += (pointer.current.x - px.x) * 0.06;
      px.y += (pointer.current.y - px.y) * 0.06;
      items.forEach((it, i) => {
        const el = refs.current[i];
        if (!el) return;
        const phase = it.phase ?? (i / items.length) * Math.PI * 2;
        const ring = it.ring ?? 1;
        const a = phase + t * speed * (ring < 0.8 ? 1.35 : 1);
        const r = radius * ring * (1 - ease);
        const depth = Math.sin(a); // -1 back .. 1 front
        const x = Math.cos(a) * r + px.x * parallax * (0.5 + depth * 0.5);
        const y = depth * r * tilt + Math.sin(t * 1.3 + i) * 6 * (1 - ease) + px.y * parallax * (0.5 + depth * 0.5);
        const s = (0.72 + (depth + 1) * 0.22) * (1 - ease * 0.55);
        el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) scale(${s}) rotate(${Math.sin(t + i) * 10}deg)`;
        el.style.zIndex = String(Math.round((depth + 1) * 50));
        el.style.filter = `blur(${Math.max(0, -depth) * 1.6}px) brightness(${0.88 + (depth + 1) * 0.08}) drop-shadow(0 ${10 + depth * 8}px 14px rgba(46,7,12,${0.18 + depth * 0.08}))`;
        el.style.opacity = String(1 - ease * 0.85);
      });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [items, radius, tilt, speed, getConverge, parallax, reduced]);

  return (
    <div aria-hidden className={`pointer-events-none absolute left-1/2 top-1/2 ${className}`}>
      {items.map((it, i) => (
        <div
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          className="absolute left-0 top-0 select-none will-change-transform"
          style={{ fontSize: it.size ?? 48, lineHeight: 1 }}
        >
          {it.emoji}
        </div>
      ))}
    </div>
  );
}
