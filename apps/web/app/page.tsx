import React from "react";
import { Navbar } from "../components/Navbar";
import { Hero } from "../components/Hero";
import { PlatformBar } from "../components/PlatformBar";
import { InteractiveShowcase } from "../components/InteractiveShowcase";
import { BentoGrid } from "../components/BentoGrid";
import { RoiCalculator } from "../components/RoiCalculator";
import { ComparisonSection } from "../components/ComparisonSection";
import { Testimonials } from "../components/Testimonials";
import { Pricing } from "../components/Pricing";
import { FaqSection } from "../components/FaqSection";
import { CtaBanner } from "../components/CtaBanner";
import { Footer } from "../components/Footer";
import { JsonLd } from "../components/JsonLd";

export default function Home() {
  return (
    <>
      <JsonLd />
      <div className="flex min-h-screen flex-col bg-background text-foreground antialiased selection:bg-primary selection:text-primary-foreground">
        <Navbar />
        <main id="main" className="flex-1">
          <Hero />
          <PlatformBar />
          <InteractiveShowcase />
          <BentoGrid />
          <RoiCalculator />
          <ComparisonSection />
          <Testimonials />
          <Pricing />
          <FaqSection />
          <CtaBanner />
        </main>
        <Footer />
      </div>
    </>
  );
}
