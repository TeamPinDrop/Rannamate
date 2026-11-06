"use client";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Camera, Check, ImagePlus, Loader2, Minus, Plus, Search, Trash2, X } from "lucide-react";
import { CATEGORIES, ingredient, searchIngredients } from "@/lib/data/ingredients";
import { actions, useStore } from "@/lib/store";
import { detectIngredients, ServiceUnavailableError, type Detection } from "@/lib/api";
import type { IngredientCategory, Unit } from "@/lib/types";
import { Notice, PageHeader } from "@/components/ui/PageHeader";

const UNITS: Unit[] = ["pcs", "g", "kg", "ml", "l", "tsp", "tbsp", "cup", "bunch"];

export default function KitchenPage() {
  const [tab, setTab] = useState<"manual" | "photo">("manual");
  const pantry = useStore((s) => s.pantry);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-20 pt-32 sm:px-6">
      <PageHeader eyebrow="My Kitchen" title={<>What do you <em className="text-burgundy">have</em>?</>} sub="Add ingredients by searching, browsing, or from a photo of your fridge. Salt, oil, water and basic spices are assumed.">
        <Link href="/discover" className={`btn-primary ${pantry.length ? "" : "pointer-events-none opacity-40"}`} aria-disabled={!pantry.length}>
          Find recipes ({pantry.length}) <ArrowRight className="h-4 w-4" />
        </Link>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="glass-strong min-w-0 rounded-[2rem] p-4 sm:p-6">
          <div className="mb-5 inline-flex rounded-full bg-white/40 p-1" role="tablist">
            {(["manual", "photo"] as const).map((t) => (
              <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`relative rounded-full px-5 py-2 text-sm font-semibold ${tab === t ? "text-cream-50" : "text-forest"}`}>
                {tab === t && <motion.span layoutId="ktab" className="absolute inset-0 rounded-full bg-forest" />}
                <span className="relative flex items-center gap-2">{t === "manual" ? <><Search className="h-4 w-4" /> Search & browse</> : <><Camera className="h-4 w-4" /> Upload photo</>}</span>
              </button>
            ))}
          </div>
          {tab === "manual" ? <ManualEntry /> : <PhotoEntry />}
        </div>
        <SelectedList />
      </div>
    </div>
  );
}

function ManualEntry() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<IngredientCategory | "All">("All");
  const pantry = useStore((s) => s.pantry);
  const have = new Set(pantry.map((p) => p.ingredientId));
  const list = useMemo(() => searchIngredients(q).filter((i) => cat === "All" || i.category === cat), [q, cat]);

  return (
    <div>
      <label className="flex items-center gap-3 rounded-full bg-white/55 px-5 py-3 ring-1 ring-white/70 focus-within:ring-2 focus-within:ring-forest">
        <Search className="h-5 w-5 text-forest/60" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tomato, paneer, rice…" className="w-full bg-transparent text-forest outline-none placeholder:text-forest/45" aria-label="Search ingredients" />
        {q && <button onClick={() => setQ("")} aria-label="Clear search"><X className="h-4 w-4 text-forest/60" /></button>}
      </label>
      <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1">
        {(["All", ...CATEGORIES] as const).map((c) => (
          <button key={c} onClick={() => setCat(c)} className={`chip shrink-0 ${cat === c ? "bg-burgundy text-cream-50" : "bg-white/35 text-forest hover:bg-white/60"}`}>{c}</button>
        ))}
      </div>
      <div className="mt-5 grid max-h-[480px] grid-cols-2 gap-2.5 overflow-y-auto pr-1 sm:grid-cols-3 md:grid-cols-4">
        {list.map((i) => {
          const on = have.has(i.id);
          return (
            <motion.button
              layout
              key={i.id}
              whileTap={{ scale: 0.95 }}
              onClick={() => actions.togglePantry(i.id, i.defaultUnit, i.defaultUnit === "g" ? 250 : 1)}
              aria-pressed={on}
              className={`flex items-center gap-2.5 rounded-2xl border p-2.5 text-left text-sm font-semibold transition ${on ? "border-forest bg-forest text-cream-50" : "border-white/60 bg-white/30 text-forest hover:bg-white/55"}`}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/75 text-2xl">{i.emoji}</span>
              <span className="min-w-0 flex-1 leading-tight">{i.name}{i.staple && <span className="block text-[10px] font-medium opacity-60">staple</span>}</span>
              {on ? <Check className="h-4 w-4 shrink-0" /> : <Plus className="h-4 w-4 shrink-0 opacity-50" />}
            </motion.button>
          );
        })}
        {!list.length && <p className="col-span-full py-10 text-center text-forest/60">No ingredient matches “{q}”.</p>}
      </div>
    </div>
  );
}

function PhotoEntry() {
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const [detections, setDetections] = useState<(Detection & { keep: boolean })[]>([]);

  const pick = (f: File | undefined) => {
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setStatus("idle");
    setDetections([]);
  };
  const analyze = async () => {
    if (!file) return;
    setStatus("loading");
    try {
      const d = await detectIngredients(file);
      setDetections(d.map((x) => ({ ...x, keep: x.confidence >= 0.8 })));
      setStatus("done");
    } catch (e) {
      setError(e instanceof ServiceUnavailableError ? e.message : "Something went wrong analysing the photo.");
      setStatus("error");
    }
  };
  const confirm = () => {
    detections.filter((d) => d.keep).forEach((d) => actions.addPantry({ ingredientId: d.ingredientId, quantity: 1, unit: ingredient(d.ingredientId).defaultUnit }));
    setDetections([]);
    setStatus("idle");
    setFile(null);
    setPreview(null);
  };

  return (
    <div>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
      <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => pick(e.target.files?.[0])} />
      {!preview ? (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files?.[0]); }}
          className="flex flex-col items-center justify-center rounded-[1.75rem] border-2 border-dashed border-forest/25 bg-white/20 px-6 py-16 text-center"
        >
          <span className="text-5xl">🧺</span>
          <p className="mt-4 font-display text-xl font-semibold text-forest">Drop a photo of your fridge or counter</p>
          <p className="mt-1 text-sm text-forest/65">JPG or PNG. We&apos;ll suggest ingredients — you confirm each one.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button onClick={() => fileRef.current?.click()} className="btn-primary"><ImagePlus className="h-4 w-4" /> Choose photo</button>
            <button onClick={() => camRef.current?.click()} className="btn-ghost"><Camera className="h-4 w-4" /> Use camera</button>
          </div>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          <div className="relative overflow-hidden rounded-[1.75rem]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Your uploaded ingredients" className="h-72 w-full object-cover" />
            {status === "loading" && (
              <motion.div className="absolute inset-x-0 h-1 bg-cream shadow-[0_0_20px_6px_rgba(245,218,191,0.8)]" animate={{ top: ["0%", "100%", "0%"] }} transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }} />
            )}
            <button onClick={() => { setPreview(null); setFile(null); setStatus("idle"); }} className="absolute right-3 top-3 rounded-full bg-black/40 p-2 text-white backdrop-blur" aria-label="Remove photo"><X className="h-4 w-4" /></button>
          </div>
          <div>
            {status === "idle" && (
              <button onClick={analyze} className="btn-primary w-full">Analyse ingredients</button>
            )}
            {status === "loading" && <p className="flex items-center gap-2 text-forest"><Loader2 className="h-4 w-4 animate-spin" /> Looking closely…</p>}
            {status === "error" && (
              <div className="space-y-3">
                <Notice tone="warn"><b>Recognition unavailable.</b> {error}</Notice>
                <button onClick={analyze} className="btn-ghost w-full">Try again</button>
              </div>
            )}
            {status === "done" && (
              <div>
                <p className="mb-3 font-semibold text-forest">Detected — tick the ones that are right:</p>
                {!detections.length && <p className="text-sm text-forest/70">Nothing recognised. Try a clearer, well-lit photo.</p>}
                <ul className="space-y-2">
                  {detections.map((d, i) => {
                    const ing = ingredient(d.ingredientId);
                    return (
                      <li key={d.ingredientId} className="flex items-center gap-3 rounded-2xl bg-white/40 p-2.5">
                        <input type="checkbox" checked={d.keep} onChange={() => setDetections((x) => x.map((y, j) => (j === i ? { ...y, keep: !y.keep } : y)))} className="h-5 w-5 accent-[#0F3D3A]" aria-label={`Keep ${ing.name}`} />
                        <span className="text-2xl">{ing.emoji}</span>
                        <span className="flex-1 font-semibold text-forest">{ing.name}</span>
                        <span className={`text-xs font-bold ${d.confidence >= 0.8 ? "text-[#1F6B4F]" : "text-[#B7791F]"}`}>{Math.round(d.confidence * 100)}%</span>
                      </li>
                    );
                  })}
                </ul>
                <button onClick={confirm} disabled={!detections.some((d) => d.keep)} className="btn-primary mt-4 w-full">Add confirmed to My Kitchen</button>
              </div>
            )}
          </div>
        </div>
      )}
      <p className="mt-4 text-xs text-forest/60">
        Photo recognition runs in the AI service via the backend (<code>POST /api/v1/scanner/ingredients</code>). Until those services are running, this shows an honest &ldquo;unavailable&rdquo; message — use manual entry instead.
      </p>
    </div>
  );
}

function SelectedList() {
  const pantry = useStore((s) => s.pantry);
  return (
    <aside className="glass rounded-[2rem] p-4 sm:p-6 lg:sticky lg:top-28 lg:self-start">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-2xl font-semibold text-forest">Your ingredients</h2>
        {pantry.length > 0 && <button onClick={actions.clearPantry} className="text-xs font-semibold text-burgundy underline underline-offset-4">Clear all</button>}
      </div>
      {!pantry.length && <p className="rounded-2xl bg-white/30 p-6 text-center text-sm text-forest/70">Nothing yet. Tap ingredients to add them.</p>}
      <ul className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
        <AnimatePresence initial={false}>
          {pantry.map((p) => {
            const ing = ingredient(p.ingredientId);
            const step = ["g", "ml"].includes(p.unit) ? 50 : p.unit === "kg" || p.unit === "l" ? 0.5 : 1;
            return (
              <motion.li key={p.ingredientId} layout initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30, height: 0 }} className="flex items-center gap-2 rounded-2xl bg-white/45 p-2">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/80 text-2xl">{ing.emoji}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-forest">{ing.name}</span>
                <button onClick={() => actions.addPantry({ ...p, quantity: Math.max(step, +(p.quantity - step).toFixed(2)) })} className="rounded-full p-1 text-forest hover:bg-white/60" aria-label={`Less ${ing.name}`}><Minus className="h-3.5 w-3.5" /></button>
                <input type="number" min={0} value={p.quantity} onChange={(e) => actions.addPantry({ ...p, quantity: Math.max(0, Number(e.target.value)) })} className="w-14 rounded-lg bg-white/70 px-1.5 py-1 text-center text-sm text-forest outline-none" aria-label={`${ing.name} quantity`} />
                <button onClick={() => actions.addPantry({ ...p, quantity: +(p.quantity + step).toFixed(2) })} className="rounded-full p-1 text-forest hover:bg-white/60" aria-label={`More ${ing.name}`}><Plus className="h-3.5 w-3.5" /></button>
                <select value={p.unit} onChange={(e) => actions.addPantry({ ...p, unit: e.target.value as Unit })} className="rounded-lg bg-white/70 px-1 py-1 text-xs text-forest outline-none" aria-label={`${ing.name} unit`}>
                  {UNITS.map((u) => <option key={u}>{u}</option>)}
                </select>
                <button onClick={() => actions.removePantry(p.ingredientId)} className="rounded-full p-1.5 text-burgundy hover:bg-burgundy/10" aria-label={`Remove ${ing.name}`}><Trash2 className="h-4 w-4" /></button>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </aside>
  );
}
