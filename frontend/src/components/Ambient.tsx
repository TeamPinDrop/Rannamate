/** Fixed, soft colour field behind every page so glass surfaces have something to refract. */
export function Ambient() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,#FCEBDA_0%,#F5DABF_45%,#EFCDAA_100%)]" />
      <div className="absolute -left-40 top-[-10%] h-[38rem] w-[38rem] rounded-full bg-burgundy/25 blur-[120px] animate-drift" />
      <div className="absolute right-[-12%] top-[30%] h-[34rem] w-[34rem] rounded-full bg-forest/25 blur-[120px] animate-drift [animation-delay:-6s]" />
      <div className="absolute bottom-[-15%] left-[25%] h-[30rem] w-[30rem] rounded-full bg-[#E8A25A]/30 blur-[120px] animate-drift [animation-delay:-12s]" />
      <div
        className="absolute inset-0 opacity-[0.06] mix-blend-multiply"
        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }}
      />
    </div>
  );
}
