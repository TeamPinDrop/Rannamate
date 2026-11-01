"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, UserRound, X } from "lucide-react";
import { LogoMark, Wordmark } from "./Logo";
import { useStore } from "@/lib/store";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/discover", label: "Discover Recipes" },
  { href: "/kitchen", label: "My Kitchen" },
  { href: "/planner", label: "Meal Planner" },
  { href: "/mate", label: "Cooking Mate" },
];

export function Navbar() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pantryCount = useStore((s) => s.pantry.length);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 20);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  useEffect(() => setOpen(false), [path]);

  if (path?.startsWith("/cook/")) return null; // distraction-free cooking mode
  const dark = path === "/mate";

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-6 sm:pt-5">
      <nav
        className={`${dark ? "glass-dark" : "glass glass-sheen"} mx-auto flex max-w-6xl items-center justify-between rounded-full px-3 py-2 transition-all duration-500 sm:px-5 ${
          scrolled ? "shadow-glass-lg" : ""
        }`}
        aria-label="Main"
      >
        <Link href="/" className={`relative flex items-center gap-2.5 ${dark ? "text-cream" : "text-burgundy"}`}>
          <LogoMark />
          <Wordmark className="text-[15px]" />
        </Link>
        <ul className="relative hidden items-center gap-1 lg:flex">
          {LINKS.map((l) => {
            const active = l.href === "/" ? path === "/" : path?.startsWith(l.href);
            return (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className={`relative block rounded-full px-4 py-2 text-[13px] font-semibold transition ${
                    active ? (dark ? "text-forest" : "text-cream-50") : dark ? "text-cream/85 hover:text-cream-50" : "text-forest hover:text-burgundy"
                  }`}
                >
                  {active && (
                    <motion.span layoutId="nav-pill" className={`absolute inset-0 rounded-full ${dark ? "bg-cream" : "bg-forest"}`} transition={{ type: "spring", stiffness: 400, damping: 34 }} />
                  )}
                  <span className="relative">
                    {l.label}
                    {l.href === "/kitchen" && pantryCount > 0 && (
                      <span className="ml-1.5 rounded-full bg-burgundy px-1.5 py-0.5 text-[10px] text-cream-50">{pantryCount}</span>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="relative flex items-center gap-2">
          <Link href="/profile" className="flex items-center gap-2 rounded-full bg-burgundy px-4 py-2 text-[13px] font-semibold text-cream-50 hover:bg-burgundy-700">
            <UserRound className="h-4 w-4" /> <span className="hidden sm:inline">Profile</span>
          </Link>
          <button className={`rounded-full p-2 lg:hidden ${dark ? "text-cream" : "text-forest"}`} aria-label="Open menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>
      <AnimatePresence>
        {open && (
          <motion.ul
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="glass-strong mx-auto mt-2 max-w-6xl rounded-3xl p-2 lg:hidden"
          >
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="block rounded-2xl px-4 py-3 font-semibold text-forest hover:bg-white/40">
                  {l.label}
                </Link>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </header>
  );
}
