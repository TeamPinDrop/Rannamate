"use client";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, ChevronLeft, ChevronRight, Download, Expand, Images, Pencil, Trash2, X } from "lucide-react";
import { CloseButton, HeartButton, Modal, Photo, SampleBadge, Stars, useToast } from "./ui";
import { downloadPhoto } from "@/lib/tastory/photos";
import { fmtDate, tastory } from "@/lib/tastory/store";
import type { Memory } from "@/lib/tastory/types";

export function MemoryDetail({ memory, onClose, onEdit, onDelete }: { memory: Memory | null; onClose: () => void; onEdit: (m: Memory) => void; onDelete: (m: Memory) => void }) {
  const toast = useToast();
  const [idx, setIdx] = useState(0);
  const [dir, setDir] = useState(1);
  const [lightbox, setLightbox] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const last = useRef<Memory | null>(null);
  if (memory) last.current = memory;
  const m = memory ?? last.current; // keep content during the exit animation
  const n = m?.photos.length ?? 0;

  useEffect(() => { setIdx(0); setLightbox(false); setConfirm(false); }, [memory?.id]);
  useEffect(() => { if (idx >= n && n) setIdx(n - 1); }, [idx, n]);

  const go = (d: number) => { if (n < 2) return; setDir(d); setIdx((i) => (i + d + n) % n); };

  const download = async () => {
    if (!m || busy) return;
    setBusy(true);
    try {
      const r = await downloadPhoto(m.photos[idx], `${m.dish}-${idx + 1}`);
      toast({ tone: "ok", text: r === "saved" ? "Photo downloaded." : "Opened the photo in a new tab — save it from there." });
    } catch (e) {
      toast({ tone: "error", text: e instanceof Error ? e.message : "Couldn't download this photo." });
    } finally { setBusy(false); }
  };

  return (
    <>
      <Modal open={!!memory && !lightbox} onClose={onClose} label={m ? `${m.dish} — memory details` : "Memory"} className="glass-strong !bg-[#FBF1E6]/95 rounded-t-[2rem] sm:max-w-5xl sm:rounded-[2rem]">
        {m && (
          <div className="grid lg:grid-cols-[1.25fr_1fr]">
            {/* photos */}
            <div className="p-3 sm:p-4 lg:pr-2">
              <div className="group relative aspect-[4/3] overflow-hidden rounded-[1.5rem] bg-forest/10 lg:aspect-[4/5]">
                <AnimatePresence initial={false} custom={dir} mode="popLayout">
                  <motion.div key={m.photos[idx]?.id} custom={dir} initial={{ opacity: 0, x: dir * 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: dir * -40 }} transition={{ duration: 0.35 }} className="absolute inset-0">
                    <button onClick={() => setLightbox(true)} className="h-full w-full cursor-zoom-in" aria-label="Open photo full screen">
                      <Photo photo={m.photos[idx]} emoji={m.emoji} className="h-full w-full" eager />
                    </button>
                  </motion.div>
                </AnimatePresence>
                <button onClick={() => setLightbox(true)} className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur hover:bg-black/70"><Expand className="h-3.5 w-3.5" /> Full screen</button>
                {n > 1 && (
                  <>
                    <button onClick={() => go(-1)} className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-forest shadow hover:bg-white" aria-label="Previous photo"><ChevronLeft className="h-5 w-5" /></button>
                    <button onClick={() => go(1)} className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-forest shadow hover:bg-white" aria-label="Next photo"><ChevronRight className="h-5 w-5" /></button>
                    <span className="absolute left-3 top-3 rounded-full bg-black/50 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">{idx + 1} / {n}</span>
                  </>
                )}
              </div>
              {n > 1 && (
                <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
                  {m.photos.map((p, i) => (
                    <button key={p.id} onClick={() => { setDir(i > idx ? 1 : -1); setIdx(i); }} className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-xl ring-2 transition ${i === idx ? "ring-burgundy" : "ring-transparent opacity-70 hover:opacity-100"}`} aria-label={`Show photo ${i + 1}`} aria-current={i === idx}>
                      <Photo photo={p} emoji={m.emoji} className="h-full w-full" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* story */}
            <div className="flex flex-col p-5 pt-2 sm:p-7 lg:pl-4">
              <div className="flex items-start justify-between gap-3">
                <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.25em] text-burgundy/80"><CalendarDays className="h-3.5 w-3.5" /> {fmtDate(m.date, { weekday: "short", day: "numeric", month: "long", year: "numeric" })}</p>
                <CloseButton onClick={onClose} />
              </div>
              <h2 className="h-display mt-1 text-4xl leading-[1.05] text-forest sm:text-5xl">{m.dish}</h2>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Stars value={m.rating} size={18} />
                <span className="flex items-center gap-1 text-xs font-semibold text-forest/60"><Images className="h-3.5 w-3.5" /> {n} photo{n === 1 ? "" : "s"}</span>
                {m.sample && <SampleBadge className="!bg-forest/10" />}
              </div>
              {m.caption && <p className="mt-5 font-display text-xl italic leading-snug text-burgundy">“{m.caption}”</p>}
              {m.notes && (
                <div className="mt-5">
                  <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-forest/50">Kitchen notes</p>
                  <p className="mt-1.5 whitespace-pre-line text-[15px] leading-relaxed text-forest/85">{m.notes}</p>
                </div>
              )}
              {!!m.tags.length && (
                <div className="mt-5 flex flex-wrap gap-1.5">{m.tags.map((t) => <span key={t} className="rounded-full bg-forest/10 px-3 py-1 text-xs font-semibold text-forest">#{t}</span>)}</div>
              )}
              {m.sample && <p className="mt-5 text-[11px] text-forest/50">Sample memory for demonstration · photo from Unsplash.</p>}

              <div className="mt-auto flex flex-wrap items-center gap-2 pt-6">
                <HeartButton on={m.favourite} onToggle={() => tastory.toggleFavourite(m.id)} />
                <button onClick={() => onEdit(m)} className="btn-ghost !px-4"><Pencil className="h-4 w-4" /> Edit</button>
                <button onClick={download} disabled={busy} className="btn-ghost !px-4"><Download className="h-4 w-4" /> Download photo</button>
                <button onClick={() => setConfirm(true)} className="ml-auto inline-flex items-center gap-1.5 rounded-full px-4 py-3 text-sm font-semibold text-burgundy transition hover:bg-burgundy/10"><Trash2 className="h-4 w-4" /> Delete</button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* full-screen lightbox */}
      <Lightbox open={!!memory && lightbox} memory={m} idx={idx} dir={dir} onClose={() => setLightbox(false)} go={go} onDownload={download} busy={busy} />

      {/* delete confirmation */}
      <Modal open={!!memory && confirm} onClose={() => setConfirm(false)} label="Delete memory?" className="glass-strong !bg-[#FBF1E6]/95 rounded-t-[2rem] p-6 sm:max-w-md sm:rounded-[2rem]">
        <p className="eyebrow">Delete memory</p>
        <h3 className="h-display mt-1 text-2xl text-forest">Delete “{m?.dish}”?</h3>
        <p className="mt-2 text-sm text-forest/75">This removes the memory and its {n} photo{n === 1 ? "" : "s"} from this browser. You&apos;ll have a few seconds to undo.</p>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={() => setConfirm(false)} className="btn-ghost" data-autofocus>Keep it</button>
          <button onClick={() => { setConfirm(false); if (m) onDelete(m); }} className="btn-primary"><Trash2 className="h-4 w-4" /> Delete</button>
        </div>
      </Modal>
    </>
  );
}

function Lightbox({ open, memory, idx, dir, onClose, go, onDownload, busy }: { open: boolean; memory: Memory | null; idx: number; dir: number; onClose: () => void; go: (d: number) => void; onDownload: () => void; busy: boolean }) {
  const startX = useRef<number | null>(null);
  useEffect(() => {
    if (!open) return;
    const on = (e: KeyboardEvent) => { if (e.key === "ArrowRight") go(1); if (e.key === "ArrowLeft") go(-1); };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [open, go]);
  const n = memory?.photos.length ?? 0;
  return (
    <Modal open={open} onClose={onClose} label="Photo viewer" tone="dark" className="!max-h-[100svh] h-[100svh] w-full sm:!max-w-none">
      {memory && (
        <div
          className="relative flex h-full w-full items-center justify-center"
          onPointerDown={(e) => { startX.current = e.clientX; }}
          onPointerUp={(e) => { if (startX.current !== null && Math.abs(e.clientX - startX.current) > 50) go(e.clientX < startX.current ? 1 : -1); startX.current = null; }}
        >
          <AnimatePresence initial={false} custom={dir} mode="popLayout">
            <motion.div key={memory.photos[idx]?.id} initial={{ opacity: 0, x: dir * 80, scale: 0.97 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: dir * -80, scale: 0.97 }} transition={{ duration: 0.35 }} className="absolute inset-0 flex items-center justify-center p-4 sm:p-14">
              <Photo photo={memory.photos[idx]} emoji={memory.emoji} className="h-full w-full rounded-xl !bg-transparent" imgClassName="!object-contain" eager />
            </motion.div>
          </AnimatePresence>
          <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-3 bg-gradient-to-b from-black/60 to-transparent p-4 text-white">
            <div className="min-w-0">
              <p className="truncate font-display text-lg">{memory.dish}</p>
              <p className="text-xs text-white/70">{idx + 1} of {n} · {fmtDate(memory.date)}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button onClick={onDownload} disabled={busy} className="flex h-10 items-center gap-1.5 rounded-full bg-white/10 px-4 text-sm font-semibold hover:bg-white/20" aria-label="Download this photo"><Download className="h-4 w-4" /> <span className="hidden sm:inline">Download</span></button>
              <button onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20" aria-label="Close full screen" data-autofocus><X className="h-5 w-5" /></button>
            </div>
          </div>
          {n > 1 && (
            <>
              <button onClick={() => go(-1)} className="absolute left-3 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur hover:bg-white/25 sm:left-6" aria-label="Previous photo"><ChevronLeft className="h-6 w-6" /></button>
              <button onClick={() => go(1)} className="absolute right-3 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur hover:bg-white/25 sm:right-6" aria-label="Next photo"><ChevronRight className="h-6 w-6" /></button>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
