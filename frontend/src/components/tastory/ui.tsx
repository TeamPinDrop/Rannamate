"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Heart, Star, X } from "lucide-react";
import { usePhotoSrc } from "@/lib/tastory/photos";
import type { PhotoRef } from "@/lib/tastory/types";

// ---------------------------------------------------------------- Photo (with skeleton + graceful fallback)

export function Photo({ photo, emoji = "🍽️", className = "", imgClassName = "", sizes, eager, onReady }: {
  photo: PhotoRef | undefined; emoji?: string; className?: string; imgClassName?: string; sizes?: string; eager?: boolean; onReady?: () => void;
}) {
  const { src, status } = usePhotoSrc(photo);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  // a cached image can finish loading before React attaches onLoad — check once mounted
  useEffect(() => {
    const el = imgRef.current;
    if (el?.complete) { if (el.naturalWidth > 0) setLoaded(true); else if (src) setFailed(true); }
    else { setLoaded(false); setFailed(false); }
  }, [src]);
  const broken = failed || status === "missing";
  return (
    <div className={`relative overflow-hidden bg-forest/10 ${className}`}>
      {!loaded && !broken && <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-cream-300/60 via-cream-100/60 to-cream-300/40" aria-hidden />}
      {broken ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-gradient-to-br from-burgundy via-burgundy-700 to-forest text-cream-50" role="img" aria-label={photo?.alt ?? "Photo unavailable"}>
          <span className="text-5xl drop-shadow-lg">{emoji}</span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cream/70">Photo unavailable</span>
        </div>
      ) : src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={imgRef}
          src={src}
          alt={photo?.alt ?? ""}
          sizes={sizes}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          draggable={false}
          onLoad={() => { setLoaded(true); onReady?.(); }}
          onError={() => setFailed(true)}
          className={`h-full w-full object-cover transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"} ${imgClassName}`}
        />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------- Modal

export function Modal({ open, onClose, children, label, className = "", tone = "light" }: { open: boolean; onClose: () => void; children: ReactNode; label: string; className?: string; tone?: "light" | "dark" }) {
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => ref.current?.querySelector<HTMLElement>("[data-autofocus], input, button")?.focus(), 60);
    return () => { clearTimeout(t); document.body.style.overflow = overflow; prev?.focus?.(); };
  }, [open]);
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.stopPropagation(); onClose(); }
    if (e.key !== "Tab" || !ref.current) return;
    const f = ref.current.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), textarea, select, [tabindex]:not([tabindex="-1"])');
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onKeyDown={onKey}>
          <motion.div className={`absolute inset-0 ${tone === "dark" ? "bg-black/85" : "bg-forest-900/55"} backdrop-blur-md`} onClick={onClose} aria-hidden />
          <motion.div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            initial={{ opacity: 0, y: 40, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 280, damping: 30 }}
            className={`relative max-h-[94svh] w-full overflow-y-auto overscroll-contain ${className}`}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function CloseButton({ onClick, label = "Close", dark }: { onClick: () => void; label?: string; dark?: boolean }) {
  return (
    <button onClick={onClick} aria-label={label} className={`flex h-10 w-10 items-center justify-center rounded-full transition ${dark ? "bg-white/10 text-cream-50 hover:bg-white/20" : "bg-forest/5 text-forest hover:bg-forest/10"}`}>
      <X className="h-5 w-5" />
    </button>
  );
}

// ---------------------------------------------------------------- Toasts

type Toast = { id: number; text: string; tone: "ok" | "error"; action?: { label: string; run: () => void } };
const ToastCtx = createContext<(t: Omit<Toast, "id">, ms?: number) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const n = useRef(0);
  const push = useCallback((t: Omit<Toast, "id">, ms = 3200) => {
    const id = ++n.current;
    setToasts((x) => [...x.slice(-2), { ...t, id }]);
    setTimeout(() => setToasts((x) => x.filter((y) => y.id !== id)), ms);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[90] flex flex-col items-center gap-2 px-4" aria-live="polite" role="status">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div key={t.id} layout initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} className={`pointer-events-auto flex max-w-md items-center gap-3 rounded-full py-2.5 pl-4 pr-2.5 text-sm font-semibold shadow-glass-lg ${t.tone === "ok" ? "bg-forest text-cream-50" : "bg-burgundy text-cream-50"}`}>
              {t.tone === "ok" ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
              <span>{t.text}</span>
              {t.action && <button onClick={() => { t.action!.run(); setToasts((x) => x.filter((y) => y.id !== t.id)); }} className="rounded-full bg-cream px-3 py-1 text-xs font-bold text-forest">{t.action.label}</button>}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}

// ---------------------------------------------------------------- Heart + stars

export function HeartButton({ on, onToggle, size = "md", className = "relative" }: { on: boolean; onToggle: () => void; size?: "sm" | "md"; className?: string }) {
  const [burst, setBurst] = useState(0);
  const dim = size === "sm" ? "h-9 w-9" : "h-11 w-11";
  return (
    <motion.button
      type="button"
      onClick={(e) => { e.stopPropagation(); if (!on) setBurst((b) => b + 1); onToggle(); }}
      whileTap={{ scale: 0.85 }}
      aria-pressed={on}
      aria-label={on ? "Remove from favourites" : "Add to favourites"}
      className={`flex ${dim} items-center justify-center rounded-full backdrop-blur-md transition ${on ? "bg-burgundy text-cream-50" : "bg-white/70 text-burgundy hover:bg-white"} ${className}`}
    >
      <motion.span key={burst} animate={on ? { scale: [1, 1.35, 1] } : { scale: 1 }} transition={{ duration: 0.4 }}>
        <Heart className={`h-[18px] w-[18px] ${on ? "fill-cream-50" : ""}`} />
      </motion.span>
      <AnimatePresence>
        {burst > 0 && on && (
          <motion.span key={`r${burst}`} className="absolute inset-0 rounded-full border-2 border-burgundy" initial={{ scale: 0.8, opacity: 0.9 }} animate={{ scale: 1.8, opacity: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.6 }} />
        )}
      </AnimatePresence>
    </motion.button>
  );
}

export function Stars({ value, onChange, size = 16, tone = "burgundy" }: { value: number | null; onChange?: (v: number | null) => void; size?: number; tone?: "burgundy" | "cream" }) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value ?? 0;
  const color = tone === "cream" ? "text-cream" : "text-burgundy";
  if (!onChange) {
    return (
      <span className={`inline-flex gap-0.5 ${color}`} role="img" aria-label={value ? `Rated ${value} out of 5` : "Not rated"}>
        {[1, 2, 3, 4, 5].map((i) => <Star key={i} style={{ width: size, height: size }} className={i <= shown ? "fill-current" : "opacity-30"} />)}
      </span>
    );
  }
  return (
    <div className={`inline-flex gap-1 ${color}`} role="radiogroup" aria-label="Rating" onMouseLeave={() => setHover(null)}>
      {[1, 2, 3, 4, 5].map((i) => (
        <button key={i} type="button" role="radio" aria-checked={value === i} aria-label={`${i} star${i > 1 ? "s" : ""}`} onMouseEnter={() => setHover(i)} onClick={() => onChange(value === i ? null : i)} className="rounded-md p-0.5 transition hover:scale-110">
          <Star style={{ width: size, height: size }} className={i <= shown ? "fill-current" : "opacity-30"} />
        </button>
      ))}
    </div>
  );
}

export function SampleBadge({ className = "" }: { className?: string }) {
  return <span className={`rounded-full bg-cream-50/90 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-forest backdrop-blur ${className}`} title="Demonstration memory with a sample photo from Unsplash">Sample</span>;
}
