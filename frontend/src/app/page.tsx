import { Hero } from "@/components/home/Hero";
import { BowlStory } from "@/components/home/BowlStory";
import { ExploreGrid } from "@/components/home/ExploreGrid";
import { FinalCTA } from "@/components/home/FinalCTA";

export default function Home() {
  return (
    <>
      <Hero />
      <BowlStory />
      <ExploreGrid />
      <FinalCTA />
    </>
  );
}
