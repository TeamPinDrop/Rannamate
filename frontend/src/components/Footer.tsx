"use client";
import { usePathname } from "next/navigation";
import { LogoMark, Wordmark } from "./Logo";

export function Footer() {
  const path = usePathname();
  if (path?.startsWith("/cook/") || path === "/mate") return null;
  return (
    <footer className="relative z-10 mx-auto max-w-6xl px-4 pb-10 pt-6 sm:px-6">
      <div className="glass flex flex-col items-center justify-between gap-3 rounded-3xl px-6 py-5 text-sm text-forest/80 sm:flex-row">
        <div className="flex items-center gap-2 text-burgundy">
          <LogoMark className="h-6 w-6" />
          <Wordmark className="text-xs" />
        </div>
        <p>Cook smarter. Waste less. Enjoy more.</p>
        <p className="text-xs">Frontend preview · data saved in this browser</p>
      </div>
    </footer>
  );
}
