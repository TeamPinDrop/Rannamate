export function PageHeader({ eyebrow, title, sub, children }: { eyebrow: string; title: React.ReactNode; sub?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
      <div className="max-w-2xl">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="h-display mt-2 text-4xl text-forest sm:text-5xl">{title}</h1>
        {sub && <p className="mt-3 text-forest/75">{sub}</p>}
      </div>
      {children}
    </div>
  );
}

export function Notice({ children, tone = "info" }: { children: React.ReactNode; tone?: "info" | "warn" }) {
  return (
    <div className={`rounded-2xl border px-4 py-3 text-sm ${tone === "warn" ? "border-burgundy/30 bg-burgundy/10 text-burgundy" : "border-forest/20 bg-forest/5 text-forest"}`}>
      {children}
    </div>
  );
}
