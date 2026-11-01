"use client";
import { motion, type HTMLMotionProps } from "framer-motion";

export function Reveal({ delay = 0, y = 28, children, ...rest }: HTMLMotionProps<"div"> & { delay?: number; y?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export function SectionHeading({ eyebrow, title, sub, center, dark }: { eyebrow: string; title: React.ReactNode; sub?: string; center?: boolean; dark?: boolean }) {
  return (
    <Reveal className={`mb-10 max-w-2xl ${center ? "mx-auto text-center" : ""}`}>
      <p className={`eyebrow ${dark ? "!text-cream/70" : ""}`}>{eyebrow}</p>
      <h2 className={`h-display mt-3 text-4xl leading-[1.05] sm:text-5xl md:text-6xl ${dark ? "text-cream-50" : "text-forest"}`}>{title}</h2>
      {sub && <p className={`mt-4 text-lg ${dark ? "text-cream/80" : "text-forest/75"}`}>{sub}</p>}
    </Reveal>
  );
}
