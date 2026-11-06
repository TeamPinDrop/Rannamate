"use client";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Cooking-mode step timer, driven by wall-clock timestamps rather than counting ticks, so it
 * stays correct when the tab is in the background, the device is busy, or the network drops.
 * Nothing else (Mate, Cook & Chill) can change it — only the user's own controls.
 */
export function useStepTimer(duration: number | null, resetKey: unknown) {
  const [endsAt, setEndsAt] = useState<number | null>(null); // set while running
  const [pausedLeft, setPausedLeft] = useState<number | null>(duration);
  const [done, setDone] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // a new step brings a fresh timer
  useEffect(() => { setEndsAt(null); setPausedLeft(duration); setDone(false); }, [duration, resetKey]);

  const running = endsAt !== null;
  const remaining = duration === null ? null : running ? Math.max(0, Math.ceil((endsAt - now) / 1000)) : pausedLeft ?? duration;

  useEffect(() => {
    if (!running) return;
    const tick = () => setNow(Date.now());
    tick();
    const t = setInterval(tick, 250);
    document.addEventListener("visibilitychange", tick);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", tick); };
  }, [running]);

  const endsRef = useRef(endsAt);
  endsRef.current = endsAt;
  useEffect(() => {
    if (running && remaining === 0) { setEndsAt(null); setPausedLeft(0); setDone(true); }
  }, [running, remaining]);

  const pausedRef = useRef(pausedLeft);
  pausedRef.current = pausedLeft;
  const start = useCallback(() => {
    const left = pausedRef.current;
    const l = left && left > 0 ? left : duration ?? 0;
    if (l <= 0) return;
    const t = Date.now();
    setDone(false);
    setPausedLeft(l);
    setNow(t);
    setEndsAt(t + l * 1000);
  }, [duration]);
  const pause = useCallback(() => {
    if (endsRef.current === null) return;
    setPausedLeft(Math.max(0, Math.ceil((endsRef.current - Date.now()) / 1000)));
    setEndsAt(null);
  }, []);
  const toggle = useCallback(() => (endsRef.current === null ? start() : pause()), [start, pause]);
  const reset = useCallback(() => { setEndsAt(null); setPausedLeft(duration); setDone(false); }, [duration]);

  return { remaining, running, done, start, pause, toggle, reset, duration };
}
