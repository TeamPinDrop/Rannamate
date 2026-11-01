export function MatchRing({ value, size = 52, dark }: { value: number; size?: number; dark?: boolean }) {
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.round(value * 100);
  const color = pct >= 80 ? "#1F6B4F" : pct >= 50 ? "#B7791F" : "#6C151E";
  return (
    <div className="relative" style={{ width: size, height: size }} aria-label={`${pct}% ingredient match`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke={dark ? "rgba(245,218,191,0.2)" : "rgba(15,61,58,0.12)"} strokeWidth="5" fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth="5" fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value)} style={{ transition: "stroke-dashoffset 1s ease" }} />
      </svg>
      <span className={`absolute inset-0 flex items-center justify-center text-[12px] font-bold ${dark ? "text-cream-50" : "text-forest"}`}>{pct}%</span>
    </div>
  );
}
