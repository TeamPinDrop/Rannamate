export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <defs>
        <linearGradient id="lm" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8E2330" />
          <stop offset="1" stopColor="#6C151E" />
        </linearGradient>
      </defs>
      <circle cx="20" cy="20" r="19" fill="url(#lm)" />
      <path d="M10 22c0 5.5 4.5 9 10 9s10-3.5 10-9H10z" fill="#F5DABF" />
      <path d="M17 18c-2-3 1-5 0-8M22 18c-2-3 1-5 0-8" stroke="#F5DABF" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <circle cx="27.5" cy="13" r="3" fill="#2E7D5B" />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return <span className={`font-display font-semibold tracking-[0.18em] ${className}`}>RANNAMATE</span>;
}
