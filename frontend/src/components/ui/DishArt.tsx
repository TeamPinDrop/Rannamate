import type { Recipe } from "@/lib/types";

/**
 * Stylised dish illustration (placeholder for real food photography —
 * drop images in /public/images/recipes/<id>.jpg in a later phase).
 */
export function DishArt({ recipe, size = "md", className = "" }: { recipe: Recipe; size?: "sm" | "md" | "lg"; className?: string }) {
  const [a, b] = recipe.palette;
  const dims = { sm: "h-16 w-16 text-3xl", md: "h-40 w-full text-6xl", lg: "h-72 w-full text-8xl sm:h-96" }[size];
  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden ${size === "sm" ? "rounded-2xl" : "rounded-[1.75rem]"} ${dims} ${className}`}
      style={{ background: `radial-gradient(circle at 30% 25%, ${a} 0%, ${b} 75%)` }}
      role="img"
      aria-label={recipe.name}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(0,0,0,0.25),transparent_60%)]" />
      {size !== "sm" && (
        <>
          <div className="absolute left-1/2 top-1/2 aspect-square w-[58%] max-w-[18rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/40 bg-white/15 shadow-[inset_0_2px_10px_rgba(255,255,255,0.4),0_30px_40px_-20px_rgba(0,0,0,0.5)] backdrop-blur-sm" />
          <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/15 blur-xl" />
        </>
      )}
      <span className="relative drop-shadow-[0_12px_18px_rgba(0,0,0,0.35)]">{recipe.emoji}</span>
    </div>
  );
}
