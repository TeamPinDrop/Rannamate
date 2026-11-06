"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, LayoutGroup, MotionConfig, motion } from "framer-motion";
import { ArrowDownUp, BookOpenText, CalendarDays, Heart, Images, LayoutGrid, Plus, Search, Sparkles, X } from "lucide-react";
import { HeartButton, Photo, SampleBadge, Stars, ToastProvider, useToast } from "@/components/tastory/ui";
import { MemoryForm } from "@/components/tastory/MemoryForm";
import { MemoryDetail } from "@/components/tastory/MemoryDetail";
import { applyView, fmtDate, groupByMonth, RECENT_LABEL, stats, tastory, useMemories } from "@/lib/tastory/store";
import type { FilterMode, Memory, SortMode, ViewMode } from "@/lib/tastory/types";

const FILTERS: { id: FilterMode; label: string; title?: string }[] = [
  { id: "all", label: "All memories" },
  { id: "favourites", label: "Favourites" },
  { id: "recent", label: "Recently added", title: RECENT_LABEL },
  { id: "top", label: "Highest rated", title: "Rated 4 stars or more" },
];
const SORTS: { id: SortMode; label: string }[] = [
  { id: "newest", label: "Newest first" },
  { id: "oldest", label: "Oldest first" },
  { id: "rating", label: "Highest rated" },
  { id: "az", label: "Alphabetical" },
];
const ASPECTS = ["aspect-[4/5]", "aspect-[4/3]", "aspect-square", "aspect-[3/4]", "aspect-[5/4]"];

export default function TastoryPage() {
  return (
    <ToastProvider>
      <MotionConfig reducedMotion="user">
        <Tastory />
      </MotionConfig>
    </ToastProvider>
  );
}

function Tastory() {
  const toast = useToast();
  const { memories, ready } = useMemories();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<FilterMode>("all");
  const [sort, setSort] = useState<SortMode>("newest");
  const [view, setView] = useState<ViewMode>("gallery");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Memory | null>(null);
  const [initialDish, setInitialDish] = useState<string | undefined>();
  const [openId, setOpenId] = useState<string | null>(null);
  const restored = useRef(new Set<string>());

  // clean up photos orphaned by an interrupted delete; pick up "?new=Dish" from cook mode
  useEffect(() => {
    void tastory.collectGarbage();
    const dish = new URLSearchParams(window.location.search).get("new");
    if (dish) {
      setInitialDish(dish.slice(0, 80));
      setFormOpen(true);
      window.history.replaceState(null, "", "/tastory");
    }
  }, []);

  const shown = useMemo(() => applyView(memories, q, filter, sort), [memories, q, filter, sort]);
  const s = useMemo(() => stats(memories), [memories]);
  const detail = openId ? memories.find((m) => m.id === openId) ?? null : null;
  const covers = useMemo(() => [...memories].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3), [memories]);

  const openAdd = () => { setEditing(null); setInitialDish(undefined); setFormOpen(true); };
  const openEdit = useCallback((m: Memory) => { setOpenId(null); setEditing(m); setFormOpen(true); }, []);

  const onSaved = (m: Memory, isNew: boolean) => {
    setFormOpen(false);
    toast({ tone: "ok", text: isNew ? `“${m.dish}” added to your Tastory.` : "Memory updated." });
    if (!isNew) setOpenId(m.id);
    if (isNew) { setQ(""); setFilter("all"); }
  };

  const onDelete = (m: Memory) => {
    setOpenId(null);
    const r = tastory.remove(m.id);
    if (!r) return;
    restored.current.delete(m.id);
    toast({ tone: "ok", text: `Deleted “${m.dish}”.`, action: { label: "Undo", run: () => { restored.current.add(m.id); tastory.restore(r.memory, r.index); } } }, 6000);
    setTimeout(() => { if (!restored.current.has(m.id)) void tastory.purgePhotos(r.memory); }, 6500);
  };

  const filtersActive = !!q || filter !== "all";
  const clearAll = () => { setQ(""); setFilter("all"); };

  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-28 sm:px-6 sm:pt-32">
      {/* ---------------- hero ---------------- */}
      <section className="relative grid items-center gap-10 lg:grid-cols-[1.15fr_1fr]">
        <div>
          <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="eyebrow flex items-center gap-2"><BookOpenText className="h-3.5 w-3.5" /> Tastory · your food journal</motion.p>
          <h1 className="h-display mt-4 text-[clamp(2.75rem,8vw,6rem)] leading-[0.95] text-forest">
            {["Every", "Dish", "Has a"].map((w, i) => (
              <motion.span key={w} className="mr-[0.22em] inline-block" initial={{ opacity: 0, y: 30, filter: "blur(8px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ delay: 0.08 + i * 0.09, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}>{w}</motion.span>
            ))}
            <motion.span className="inline-block italic text-burgundy" initial={{ opacity: 0, y: 30, filter: "blur(8px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ delay: 0.4, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}>Story.</motion.span>
          </h1>
          <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55, duration: 0.6 }} className="mt-5 max-w-xl text-lg leading-relaxed text-forest/75">
            Save the flavours, moments, and little victories that make your kitchen yours.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65, duration: 0.6 }} className="mt-7 flex flex-wrap items-center gap-3">
            <button onClick={openAdd} className="btn-primary !px-7 !py-3.5 text-base"><Plus className="h-5 w-5" /> Add a Memory</button>
            {s.samples > 0 && (
              <button onClick={() => { tastory.removeSamples(); toast({ tone: "ok", text: "Sample memories removed." }); }} className="text-sm font-semibold text-forest/65 underline-offset-4 hover:text-forest hover:underline">
                Clear {s.samples} sample {s.samples === 1 ? "memory" : "memories"}
              </button>
            )}
          </motion.div>

          {/* stats — computed from the memories saved in this browser */}
          <motion.dl initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.75, duration: 0.6 }} className="mt-9 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { icon: BookOpenText, label: "Memories", value: ready ? String(s.memories) : "–" },
              { icon: Images, label: "Photographs", value: ready ? String(s.photos) : "–" },
              { icon: Heart, label: "Favourite dishes", value: ready ? String(s.favourites) : "–" },
              { icon: CalendarDays, label: "Latest memory", value: ready && s.latest ? fmtDate(s.latest, { day: "numeric", month: "short" }) : "–", sub: ready && s.latest ? s.latest.slice(0, 4) : undefined },
            ].map((x) => (
              <div key={x.label} className="glass glass-sheen rounded-[1.5rem] p-4">
                <dt className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-forest/55"><x.icon className="h-3.5 w-3.5" /> {x.label}</dt>
                <dd className="mt-1.5 font-display text-3xl text-forest">{x.value}{x.sub && <span className="ml-1.5 text-sm text-forest/50">{x.sub}</span>}</dd>
              </div>
            ))}
          </motion.dl>
          {s.samples > 0 && <p className="mt-3 text-[11px] text-forest/55">Includes {s.samples} sample {s.samples === 1 ? "memory" : "memories"} with photos from Unsplash. Your memories are stored only in this browser.</p>}
        </div>

        {/* editorial collage of the latest covers */}
        <div className="relative hidden h-[30rem] lg:block" aria-hidden>
          {covers.length ? covers.map((m, i) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 40, rotate: 0 }}
              animate={{ opacity: 1, y: 0, rotate: [-6, 4, -2][i] }}
              transition={{ delay: 0.3 + i * 0.15, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
              className={`glass absolute overflow-hidden rounded-[2rem] p-2 ${["left-0 top-10 w-[56%] z-20", "right-0 top-0 w-[48%] z-10", "bottom-0 right-[14%] w-[44%] z-30"][i]}`}
            >
              <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 7 + i, repeat: Infinity, ease: "easeInOut" }}>
                <Photo photo={m.photos[0]} emoji={m.emoji} className={`${["aspect-[4/5]", "aspect-square", "aspect-[4/3]"][i]} rounded-[1.5rem]`} eager />
                <p className="truncate px-2 pb-1 pt-2 font-display text-sm text-forest">{m.dish}</p>
              </motion.div>
            </motion.div>
          )) : (
            <div className="glass absolute inset-10 flex items-center justify-center rounded-[2.5rem] text-8xl">🍲</div>
          )}
        </div>
      </section>

      {/* ---------------- controls ---------------- */}
      <section className="mt-16 sm:mt-20" aria-label="Your memories">
        <div className="glass flex flex-col gap-3 rounded-[1.75rem] p-3 lg:flex-row lg:items-center">
          <label className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-white/60 px-4 py-2.5 focus-within:bg-white">
            <Search className="h-4 w-4 shrink-0 text-forest/60" />
            <input value={q} onChange={(e) => setQ(e.target.value.slice(0, 80))} placeholder="Search dishes, captions, notes or #tags" className="min-w-0 flex-1 bg-transparent text-sm text-forest outline-none placeholder:text-forest/45" aria-label="Search memories" type="search" />
            {q && <button onClick={() => setQ("")} aria-label="Clear search" className="text-forest/60 hover:text-forest"><X className="h-4 w-4" /></button>}
          </label>
          <LayoutGroup id="filters">
            <div className="no-scrollbar flex gap-1 overflow-x-auto" role="tablist" aria-label="Filter memories">
              {FILTERS.map((f) => (
                <button key={f.id} role="tab" aria-selected={filter === f.id} title={f.title} onClick={() => setFilter(f.id)} className={`relative shrink-0 rounded-full px-3.5 py-2 text-[13px] font-semibold transition ${filter === f.id ? "text-cream-50" : "text-forest hover:bg-white/50"}`}>
                  {filter === f.id && <motion.span layoutId="t-filter" className="absolute inset-0 rounded-full bg-forest" transition={{ type: "spring", stiffness: 400, damping: 34 }} />}
                  <span className="relative">{f.label}</span>
                </button>
              ))}
            </div>
          </LayoutGroup>
          <div className="flex items-center gap-2">
            <label className="flex flex-1 items-center gap-1.5 rounded-full bg-white/60 px-3 py-2 text-[13px] font-semibold text-forest lg:flex-none">
              <ArrowDownUp className="h-4 w-4 text-forest/60" />
              <span className="sr-only">Sort</span>
              <select value={sort} onChange={(e) => setSort(e.target.value as SortMode)} className="min-w-0 flex-1 bg-transparent outline-none" aria-label="Sort memories">
                {SORTS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
              </select>
            </label>
            <div className="flex rounded-full bg-white/60 p-1" role="radiogroup" aria-label="View">
              {([["gallery", LayoutGrid, "Gallery"], ["timeline", CalendarDays, "Timeline"]] as const).map(([id, Icon, label]) => (
                <button key={id} role="radio" aria-checked={view === id} onClick={() => setView(id)} className={`relative flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold transition ${view === id ? "text-cream-50" : "text-forest"}`}>
                  {view === id && <motion.span layoutId="t-view" className="absolute inset-0 rounded-full bg-burgundy" transition={{ type: "spring", stiffness: 400, damping: 34 }} />}
                  <Icon className="relative h-4 w-4" /><span className="relative hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        {ready && memories.length > 0 && (
          <p className="mt-3 px-2 text-xs text-forest/60" aria-live="polite">
            {filtersActive ? `${shown.length} of ${memories.length} memories` : `${memories.length} ${memories.length === 1 ? "memory" : "memories"}`}
            {filter === "recent" && ` · ${RECENT_LABEL.toLowerCase()}`}
            {filtersActive && <button onClick={clearAll} className="ml-2 font-semibold text-burgundy underline-offset-4 hover:underline">Clear filters</button>}
          </p>
        )}

        {/* ---------------- content ---------------- */}
        <div className="mt-6">
          {!ready ? (
            <SkeletonGrid />
          ) : memories.length === 0 ? (
            <EmptyJournal onAdd={openAdd} />
          ) : shown.length === 0 ? (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass mx-auto max-w-lg rounded-[2rem] p-10 text-center">
              <p className="text-5xl">🔍</p>
              <p className="h-display mt-3 text-2xl text-forest">No memories match{q ? ` “${q}”` : " this filter"}.</p>
              <p className="mt-2 text-sm text-forest/70">Try another word, or look through everything.</p>
              <button onClick={clearAll} className="btn-ghost mt-5">Clear search &amp; filters</button>
            </motion.div>
          ) : (
            <AnimatePresence mode="wait">
              {view === "gallery" ? (
                <motion.div key="gallery" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: 10 }} transition={{ duration: 0.3 }} className="columns-1 gap-5 sm:columns-2 lg:columns-3">
                  <AnimatePresence>
                    {shown.map((m, i) => <MemoryCard key={m.id} m={m} i={i} onOpen={() => setOpenId(m.id)} />)}
                  </AnimatePresence>
                </motion.div>
              ) : (
                <motion.div key="timeline" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.35 }}>
                  <Timeline list={shown} onOpen={setOpenId} />
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>
      </section>

      <MemoryForm open={formOpen} onClose={() => setFormOpen(false)} editing={editing} initialDish={initialDish} onSaved={onSaved} />
      <MemoryDetail memory={detail} onClose={() => setOpenId(null)} onEdit={openEdit} onDelete={onDelete} />
    </div>
  );
}

function MemoryCard({ m, i, onOpen }: { m: Memory; i: number; onOpen: () => void }) {
  return (
    <motion.article
      layout="position"
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.6, delay: (i % 3) * 0.08, ease: [0.22, 1, 0.36, 1] }}
      className="group mb-5 break-inside-avoid"
    >
      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}
        aria-label={`Open ${m.dish}, ${fmtDate(m.date)}`}
        className="glass cursor-pointer overflow-hidden rounded-[2rem] p-2 transition-shadow duration-500 hover:shadow-glass-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-burgundy"
      >
        <div className="relative overflow-hidden rounded-[1.6rem]">
          <Photo photo={m.photos[0]} emoji={m.emoji} className={ASPECTS[i % ASPECTS.length]} imgClassName="transition-transform duration-[900ms] ease-out group-hover:scale-[1.06]" sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent opacity-80 transition-opacity duration-500 group-hover:opacity-100" />
          {m.sample && <SampleBadge className="absolute left-3 top-3" />}
          <HeartButton on={m.favourite} onToggle={() => tastory.toggleFavourite(m.id)} size="sm" className="absolute right-3 top-3" />
          <span className="absolute bottom-3 left-3 flex items-center gap-1 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur"><Images className="h-3.5 w-3.5" /> {m.photos.length}</span>
          {m.rating ? <span className="absolute bottom-3 right-3 rounded-full bg-black/45 px-2 py-1 backdrop-blur"><Stars value={m.rating} size={11} tone="cream" /></span> : null}
        </div>
        <div className="px-3 pb-3 pt-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-burgundy/75">{fmtDate(m.date, { day: "numeric", month: "long", year: "numeric" })}</p>
          <h3 className="h-display mt-1 text-2xl leading-tight text-forest">{m.dish}</h3>
          {m.caption && <p className="mt-1.5 line-clamp-2 font-display text-[15px] italic leading-snug text-forest/70">{m.caption}</p>}
          {!!m.tags.length && <p className="mt-2.5 truncate text-[11px] font-semibold text-forest/50">{m.tags.map((t) => `#${t}`).join("  ")}</p>}
        </div>
      </div>
    </motion.article>
  );
}

function Timeline({ list, onOpen }: { list: Memory[]; onOpen: (id: string) => void }) {
  const groups = groupByMonth(list);
  return (
    <ol className="relative ml-3 border-l-2 border-forest/15 pl-6 sm:ml-6 sm:pl-10">
      {groups.map((g, gi) => (
        <li key={g.key} className="mb-12 last:mb-0">
          <motion.h3 initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="relative font-display text-3xl text-forest">
            <span className="absolute -left-[33px] top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-4 border-cream bg-burgundy shadow sm:-left-[49px]" aria-hidden />
            {g.label}
            <span className="ml-3 align-middle text-xs font-semibold text-forest/50">{g.items.length} {g.items.length === 1 ? "memory" : "memories"}</span>
          </motion.h3>
          <ul className="mt-5 grid gap-4">
            {g.items.map((m, i) => (
              <motion.li key={m.id} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-30px" }} transition={{ delay: Math.min(i, 4) * 0.06 + gi * 0.02, duration: 0.5 }}>
                <div role="button" tabIndex={0} onClick={() => onOpen(m.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(m.id); } }} aria-label={`Open ${m.dish}, ${fmtDate(m.date)}`} className="glass group flex cursor-pointer items-center gap-4 rounded-[1.75rem] p-2.5 pr-4 transition hover:shadow-glass-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-burgundy sm:gap-6">
                  <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-[1.25rem] sm:h-32 sm:w-40">
                    <Photo photo={m.photos[0]} emoji={m.emoji} className="h-full w-full" imgClassName="transition-transform duration-700 group-hover:scale-110" />
                  </div>
                  <div className="hidden w-14 shrink-0 text-center sm:block">
                    <p className="font-display text-4xl leading-none text-burgundy">{Number(m.date.slice(8, 10))}</p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-forest/50">{fmtDate(m.date, { weekday: "short" })}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-forest/50 sm:hidden">{fmtDate(m.date)}</p>
                    <div className="flex items-center gap-2"><h4 className="h-display truncate text-xl text-forest sm:text-2xl">{m.dish}</h4>{m.sample && <SampleBadge className="!bg-forest/10" />}</div>
                    {m.caption && <p className="mt-0.5 line-clamp-2 text-sm italic text-forest/65">{m.caption}</p>}
                    <div className="mt-2 flex items-center gap-3 text-xs text-forest/55"><Stars value={m.rating} size={12} /><span className="flex items-center gap-1"><Images className="h-3.5 w-3.5" /> {m.photos.length}</span></div>
                  </div>
                  <HeartButton on={m.favourite} onToggle={() => tastory.toggleFavourite(m.id)} size="sm" className="relative shrink-0" />
                </div>
              </motion.li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}

function SkeletonGrid() {
  return (
    <div className="columns-1 gap-5 sm:columns-2 lg:columns-3" aria-busy="true" aria-label="Loading memories">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="glass mb-5 break-inside-avoid rounded-[2rem] p-2">
          <div className={`${ASPECTS[i % ASPECTS.length]} animate-pulse rounded-[1.6rem] bg-forest/10`} />
          <div className="space-y-2 px-3 pb-3 pt-4"><div className="h-2.5 w-24 animate-pulse rounded bg-forest/10" /><div className="h-5 w-40 animate-pulse rounded bg-forest/15" /><div className="h-3 w-full animate-pulse rounded bg-forest/10" /></div>
        </div>
      ))}
    </div>
  );
}

function EmptyJournal({ onAdd }: { onAdd: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass glass-sheen relative mx-auto max-w-2xl overflow-hidden rounded-[2.5rem] px-6 py-14 text-center">
      <div className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full bg-burgundy/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-forest/20 blur-3xl" />
      <motion.div className="relative mx-auto flex w-fit gap-3 text-5xl" animate={{ y: [0, -6, 0] }} transition={{ duration: 4, repeat: Infinity }}>🍳<span className="-mt-3">📸</span>🥘</motion.div>
      <h2 className="h-display relative mt-6 text-4xl text-forest">Your story starts in the kitchen.</h2>
      <p className="relative mx-auto mt-3 max-w-md text-forest/70">Cook something, take a photo, and keep the moment — the dish, the date, and what made it special.</p>
      <button onClick={onAdd} className="btn-primary relative mt-7 !px-7 !py-3.5"><Sparkles className="h-4 w-4" /> Add Your First Memory</button>
    </motion.div>
  );
}
