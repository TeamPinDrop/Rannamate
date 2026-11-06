"use client";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Heart, ImagePlus, Loader2, Star, UploadCloud, X } from "lucide-react";
import { CloseButton, Modal, Photo, Stars, useToast } from "./ui";
import { deletePhotos, putPhoto } from "@/lib/tastory/photos";
import { newId, tastory, todayISO } from "@/lib/tastory/store";
import type { Memory, PhotoRef } from "@/lib/tastory/types";

const MAX_PHOTOS = 12;
const MAX_MB = 15;
const OK_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];

type Item = { key: string; existing?: PhotoRef; file?: File; preview?: string };

const emptyForm = (dish = "") => ({ dish, date: todayISO(), caption: "", notes: "", rating: null as number | null, tags: [] as string[], favourite: false });

export function MemoryForm({ open, onClose, editing, initialDish, onSaved }: {
  open: boolean; onClose: () => void; editing?: Memory | null; initialDish?: string; onSaved: (m: Memory, isNew: boolean) => void;
}) {
  const toast = useToast();
  const [f, setF] = useState(emptyForm());
  const [items, setItems] = useState<Item[]>([]);
  const [tagDraft, setTagDraft] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<{ done: number; total: number; pct: number } | null>(null);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // load the memory being edited (or a blank form) each time the modal opens
  useEffect(() => {
    if (!open) return;
    setErrors({}); setSaving(null); setTagDraft("");
    if (editing) {
      setF({ dish: editing.dish, date: editing.date, caption: editing.caption, notes: editing.notes, rating: editing.rating, tags: editing.tags, favourite: editing.favourite });
      setItems(editing.photos.map((p) => ({ key: p.id, existing: p })));
    } else {
      setF(emptyForm(initialDish ?? ""));
      setItems([]);
    }
  }, [open, editing, initialDish]);

  // release preview URLs
  useEffect(() => () => itemsRef.current.forEach((i) => i.preview && URL.revokeObjectURL(i.preview)), []);
  const close = () => {
    if (saving) return;
    items.forEach((i) => i.preview && URL.revokeObjectURL(i.preview));
    onClose();
  };

  const addFiles = (list: FileList | File[]) => {
    const files = Array.from(list);
    const rejected: string[] = [];
    const next: Item[] = [];
    for (const file of files) {
      if (!OK_TYPES.includes(file.type)) { rejected.push(`${file.name} isn't a JPG, PNG, WebP, GIF or AVIF image`); continue; }
      if (file.size > MAX_MB * 1024 * 1024) { rejected.push(`${file.name} is over ${MAX_MB} MB`); continue; }
      if (items.length + next.length >= MAX_PHOTOS) { rejected.push(`only ${MAX_PHOTOS} photos per memory`); break; }
      next.push({ key: newId("f"), file, preview: URL.createObjectURL(file) });
    }
    if (next.length) { setItems((x) => [...x, ...next]); setErrors((e) => ({ ...e, photos: "" })); }
    if (rejected.length) toast({ tone: "error", text: `Skipped: ${rejected.slice(0, 2).join("; ")}${rejected.length > 2 ? "…" : ""}` }, 4500);
  };

  const removeItem = (key: string) => setItems((x) => { const it = x.find((i) => i.key === key); if (it?.preview) URL.revokeObjectURL(it.preview); return x.filter((i) => i.key !== key); });
  const move = (i: number, d: number) => setItems((x) => { const j = i + d; if (j < 0 || j >= x.length) return x; const c = [...x]; [c[i], c[j]] = [c[j], c[i]]; return c; });
  const makeCover = (i: number) => setItems((x) => [x[i], ...x.filter((_, k) => k !== i)]);

  const addTag = (raw: string) => {
    const t = raw.trim().replace(/^#/, "").toLowerCase().slice(0, 24);
    if (!t || f.tags.includes(t) || f.tags.length >= 10) { setTagDraft(""); return; }
    setF((x) => ({ ...x, tags: [...x.tags, t] }));
    setTagDraft("");
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!f.dish.trim()) e.dish = "Give your dish a name.";
    else if (f.dish.trim().length > 80) e.dish = "Keep the name under 80 characters.";
    if (!items.length) e.photos = "Add at least one photograph.";
    if (f.date && f.date > todayISO()) e.date = "The cooking date can't be in the future.";
    if (f.caption.length > 160) e.caption = "Keep the caption under 160 characters.";
    setErrors(e);
    return !Object.keys(e).length;
  };

  const save = async () => {
    if (saving) return;
    if (tagDraft.trim()) addTag(tagDraft);
    if (!validate()) { toast({ tone: "error", text: "Please fix the highlighted fields." }); return; }
    const fresh = items.filter((i) => i.file);
    const total = Math.max(1, fresh.length);
    setSaving({ done: 0, total, pct: 0 });
    const stored: string[] = [];
    try {
      const photos: PhotoRef[] = [];
      let done = 0;
      for (const it of items) {
        if (it.existing) { photos.push(it.existing); continue; }
        const id = newId("p");
        // the write itself is fast; the short pause just lets the progress read clearly
        await Promise.all([putPhoto(id, it.file!), new Promise((r) => setTimeout(r, 280))]);
        stored.push(id);
        photos.push({ id, kind: "local", name: it.file!.name, type: it.file!.type, alt: `${f.dish.trim()} — photo ${photos.length + 1}` });
        done++;
        setSaving({ done, total, pct: Math.round((done / total) * 100) });
      }
      if (!fresh.length) setSaving({ done: 1, total: 1, pct: 100 });
      await new Promise((r) => setTimeout(r, 250));

      const base = { dish: f.dish.trim(), date: f.date || todayISO(), caption: f.caption.trim(), notes: f.notes.trim(), rating: f.rating, tags: f.tags, favourite: f.favourite };
      let saved: Memory;
      if (editing) {
        const kept = new Set(photos.map((p) => p.id));
        const dropped = editing.photos.filter((p) => p.kind === "local" && !kept.has(p.id)).map((p) => p.id);
        tastory.update(editing.id, { ...base, photos });
        saved = { ...editing, ...base, photos, updatedAt: Date.now() };
        if (dropped.length) await deletePhotos(dropped).catch(() => undefined);
      } else {
        saved = { id: newId("m"), ...base, photos, createdAt: Date.now(), updatedAt: Date.now() };
        tastory.add(saved);
      }
      items.forEach((i) => i.preview && URL.revokeObjectURL(i.preview));
      setSaving(null);
      onSaved(saved, !editing);
    } catch (err) {
      await deletePhotos(stored).catch(() => undefined);
      setSaving(null);
      toast({ tone: "error", text: err instanceof Error && /space|quota/i.test(err.message) ? "This browser is out of storage space — try fewer or smaller photos." : "Couldn't save the photos in this browser. Please try again." }, 5000);
    }
  };

  const field = "w-full rounded-2xl border bg-white/70 px-4 py-3 text-[15px] text-forest outline-none transition placeholder:text-forest/40 focus:border-forest/50 focus:bg-white";
  const err = (k: string) => (errors[k] ? "border-burgundy/70" : "border-forest/15");

  return (
    <Modal open={open} onClose={close} label={editing ? "Edit memory" : "Add a memory"} className="glass-strong !bg-[#FBF1E6]/95 rounded-t-[2rem] p-5 sm:max-w-3xl sm:rounded-[2rem] sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Tastory</p>
          <h2 className="h-display mt-1 text-3xl text-forest sm:text-4xl">{editing ? "Edit this memory" : "Add a memory"}</h2>
        </div>
        <CloseButton onClick={close} />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); void save(); }} className="mt-5 grid gap-5" noValidate>
        {/* photos */}
        <div>
          <div className="flex items-baseline justify-between">
            <label className="text-sm font-bold text-forest">Photographs <span className="text-burgundy">*</span></label>
            <span className="text-xs text-forest/60">{items.length}/{MAX_PHOTOS} · first photo is the cover</span>
          </div>
          <div
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files); }}
            className={`mt-2 rounded-[1.5rem] border-2 border-dashed p-3 transition ${drag ? "border-burgundy bg-burgundy/5" : errors.photos ? "border-burgundy/60" : "border-forest/20"}`}
          >
            <input ref={fileRef} type="file" accept={OK_TYPES.join(",")} multiple className="sr-only" id="tastory-files" onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
            {items.length ? (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <AnimatePresence initial={false}>
                  {items.map((it, i) => (
                    <motion.li key={it.key} layout initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.85 }} className="group relative aspect-square overflow-hidden rounded-2xl ring-1 ring-forest/10">
                      {it.preview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={it.preview} alt={`Selected photo ${i + 1}`} className="h-full w-full object-cover" />
                      ) : (
                        <Photo photo={it.existing} className="h-full w-full" />
                      )}
                      {i === 0 && <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-burgundy px-2 py-0.5 text-[10px] font-bold text-cream-50"><Star className="h-3 w-3 fill-current" /> Cover</span>}
                      <button type="button" onClick={() => removeItem(it.key)} className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur hover:bg-black/75" aria-label={`Remove photo ${i + 1}`}><X className="h-4 w-4" /></button>
                      <div className="absolute inset-x-2 bottom-2 flex items-center justify-between gap-1">
                        <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/85 text-forest disabled:opacity-0" aria-label={`Move photo ${i + 1} earlier`}><ChevronLeft className="h-4 w-4" /></button>
                        {i !== 0 && <button type="button" onClick={() => makeCover(i)} className="rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold text-forest hover:bg-white">Set cover</button>}
                        <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/85 text-forest disabled:opacity-0" aria-label={`Move photo ${i + 1} later`}><ChevronRight className="h-4 w-4" /></button>
                      </div>
                    </motion.li>
                  ))}
                </AnimatePresence>
                {items.length < MAX_PHOTOS && (
                  <li>
                    <label htmlFor="tastory-files" className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl bg-forest/5 text-sm font-semibold text-forest transition hover:bg-forest/10">
                      <ImagePlus className="h-6 w-6" /> Add more
                    </label>
                  </li>
                )}
              </ul>
            ) : (
              <label htmlFor="tastory-files" className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl px-4 py-10 text-center text-forest transition hover:bg-forest/5">
                <motion.span animate={{ y: [0, -5, 0] }} transition={{ duration: 2.4, repeat: Infinity }}><UploadCloud className="h-10 w-10 text-burgundy" /></motion.span>
                <span className="font-display text-xl">Drop photos here, or tap to choose</span>
                <span className="text-xs text-forest/60">JPG, PNG, WebP, GIF or AVIF · up to {MAX_PHOTOS} photos, {MAX_MB} MB each</span>
              </label>
            )}
          </div>
          {errors.photos && <p className="mt-1.5 text-sm font-semibold text-burgundy" role="alert">{errors.photos}</p>}
        </div>

        <div className="grid gap-4 sm:grid-cols-[1.4fr_1fr]">
          <div>
            <label htmlFor="t-dish" className="text-sm font-bold text-forest">Dish name <span className="text-burgundy">*</span></label>
            <input id="t-dish" data-autofocus value={f.dish} onChange={(e) => { setF({ ...f, dish: e.target.value.slice(0, 90) }); if (errors.dish) setErrors({ ...errors, dish: "" }); }} placeholder="e.g. Grandma's rajma chawal" className={`${field} ${err("dish")} mt-1.5`} aria-invalid={!!errors.dish} />
            {errors.dish && <p className="mt-1 text-sm font-semibold text-burgundy" role="alert">{errors.dish}</p>}
          </div>
          <div>
            <label htmlFor="t-date" className="text-sm font-bold text-forest">Cooking date</label>
            <input id="t-date" type="date" max={todayISO()} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} className={`${field} ${err("date")} mt-1.5`} aria-invalid={!!errors.date} />
            {errors.date && <p className="mt-1 text-sm font-semibold text-burgundy" role="alert">{errors.date}</p>}
          </div>
        </div>

        <div>
          <label htmlFor="t-caption" className="flex justify-between text-sm font-bold text-forest">Caption <span className="font-normal text-forest/50">{f.caption.length}/160</span></label>
          <input id="t-caption" value={f.caption} onChange={(e) => setF({ ...f, caption: e.target.value.slice(0, 160) })} placeholder="One line you'll want to remember" className={`${field} ${err("caption")} mt-1.5`} />
        </div>

        <div>
          <label htmlFor="t-notes" className="text-sm font-bold text-forest">Personal notes</label>
          <textarea id="t-notes" rows={3} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value.slice(0, 2000) })} placeholder="What worked, what you'd change, who you cooked for…" className={`${field} border-forest/15 mt-1.5 resize-y`} />
        </div>

        <div className="grid gap-4 sm:grid-cols-[1fr_1.4fr]">
          <div>
            <p className="text-sm font-bold text-forest">Rating</p>
            <div className="mt-2 flex items-center gap-3"><Stars value={f.rating} onChange={(v) => setF({ ...f, rating: v })} size={24} /><span className="text-xs text-forest/60">{f.rating ? `${f.rating}/5` : "Optional"}</span></div>
          </div>
          <div>
            <label htmlFor="t-tags" className="text-sm font-bold text-forest">Tags</label>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 rounded-2xl border border-forest/15 bg-white/70 px-3 py-2">
              {f.tags.map((t) => (
                <span key={t} className="flex items-center gap-1 rounded-full bg-forest px-2.5 py-1 text-xs font-semibold text-cream-50">#{t}<button type="button" onClick={() => setF({ ...f, tags: f.tags.filter((x) => x !== t) })} aria-label={`Remove tag ${t}`}><X className="h-3 w-3" /></button></span>
              ))}
              <input id="t-tags" value={tagDraft} onChange={(e) => setTagDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(tagDraft); } if (e.key === "Backspace" && !tagDraft && f.tags.length) setF({ ...f, tags: f.tags.slice(0, -1) }); }} onBlur={() => tagDraft && addTag(tagDraft)} placeholder={f.tags.length ? "" : "breakfast, family… (Enter to add)"} className="min-w-[8rem] flex-1 bg-transparent py-1 text-sm text-forest outline-none placeholder:text-forest/40" />
            </div>
          </div>
        </div>

        <button type="button" onClick={() => setF({ ...f, favourite: !f.favourite })} aria-pressed={f.favourite} className={`flex items-center gap-2 self-start rounded-full px-4 py-2 text-sm font-semibold transition ${f.favourite ? "bg-burgundy text-cream-50" : "bg-forest/5 text-forest hover:bg-forest/10"}`}>
          <Heart className={`h-4 w-4 ${f.favourite ? "fill-current" : ""}`} /> {f.favourite ? "Favourite" : "Mark as favourite"}
        </button>

        <AnimatePresence>
          {saving && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden" role="status" aria-live="polite">
              <div className="flex items-center justify-between text-xs font-semibold text-forest/75">
                <span className="flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving to this browser… {saving.done}/{saving.total}</span>
                <span>{saving.pct}%</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-forest/10">
                <motion.div className="h-full rounded-full bg-gradient-to-r from-burgundy to-forest" animate={{ width: `${Math.max(6, saving.pct)}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-col-reverse items-stretch gap-2 border-t border-forest/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] text-forest/55">Saved only in this browser on this device — not uploaded or synced.</p>
          <div className="flex gap-2">
            <button type="button" onClick={close} disabled={!!saving} className="btn-ghost flex-1 sm:flex-none">Cancel</button>
            <button type="submit" disabled={!!saving} className="btn-primary flex-1 sm:flex-none">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{editing ? "Save changes" : "Save memory"}</button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

