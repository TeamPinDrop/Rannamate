"use client";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Reveal } from "../ui/Reveal";
import { LogoMark } from "../Logo";

export function FinalCTA() {
  return (
    <section className="relative mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-6">
      <Reveal className="glass-strong glass-sheen relative overflow-hidden rounded-[3rem] px-6 py-20 text-center">
        <div className="pointer-events-none absolute inset-0 select-none text-6xl opacity-60" aria-hidden>
          <span className="absolute left-[6%] top-[15%] animate-float">🍅</span>
          <span className="absolute right-[8%] top-[20%] animate-float [animation-delay:-1.5s]">🥕</span>
          <span className="absolute bottom-[12%] left-[14%] animate-float [animation-delay:-3s]">🌿</span>
          <span className="absolute bottom-[15%] right-[14%] animate-float [animation-delay:-4.5s]">🥚</span>
        </div>
        <LogoMark className="relative mx-auto h-14 w-14" />
        <h2 className="relative mt-6 font-display text-5xl font-semibold tracking-[0.2em] text-burgundy sm:text-7xl">RANNAMATE</h2>
        <p className="relative mt-4 font-display text-xl italic text-forest sm:text-2xl">Your Kitchen. Your Mood. Your Mate.</p>
        <p className="relative mt-2 text-forest/70">Cook smarter. Waste less. Enjoy more.</p>
        <Link href="/kitchen" className="btn-primary relative mt-8 !px-8 !py-4 text-base">Start Your Cooking Journey <ArrowRight className="h-4 w-4" /></Link>
      </Reveal>
    </section>
  );
}
