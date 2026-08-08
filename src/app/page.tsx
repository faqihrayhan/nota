import { Nav } from "@/components/Nav";
import { Hero } from "@/components/Hero";
import { StatsSection } from "@/components/StatsSection";
import { WorkflowSection } from "@/components/WorkflowSection";
import { FeatureSection } from "@/components/FeatureSection";
import { FAQ } from "@/components/FAQ";
import { Footer } from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Nav />
      <main className="flex-1">
        <Hero />
        <StatsSection />
        <WorkflowSection />
        <FeatureSection />
        <FAQ />
      </main>
      <Footer />
    </>
  );
}
