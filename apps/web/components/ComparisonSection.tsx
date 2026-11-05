import React from "react";
import { Check, X, Sparkles } from "lucide-react";
import { siteConfig } from "../lib/site";

export function ComparisonSection() {
  return (
    <section className="py-20 sm:py-28 bg-background">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3">
            THE BLYNTA ADVANTAGE
          </p>
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-foreground mb-4">
            Why creators are ditching traditional clipping.
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
            Stop waiting days for expensive freelancers to manually rewatch your footage.
          </p>
        </div>

        {/* Comparison Table */}
        <div className="rounded-3xl border border-border bg-card overflow-hidden shadow-lg">
          <div className="grid grid-cols-12 border-b border-border bg-muted/30 p-4 sm:p-6 text-xs sm:text-sm font-bold">
            <div className="col-span-4 text-muted-foreground uppercase tracking-wider">
              Dimension
            </div>
            <div className="col-span-4 text-muted-foreground uppercase tracking-wider text-center">
              Traditional Agencies
            </div>
            <div className="col-span-4 text-primary font-extrabold uppercase tracking-wider text-center flex items-center justify-center gap-1.5">
              <Sparkles className="h-4 w-4" />
              <span>Blynta Engine</span>
            </div>
          </div>

          <div className="divide-y divide-border/60">
            {siteConfig.comparison.map((row, idx) => (
              <div
                key={idx}
                className="grid grid-cols-12 p-4 sm:p-6 text-xs sm:text-sm items-center hover:bg-muted/20 transition-colors"
              >
                <div className="col-span-4 font-bold text-foreground">
                  {row.feature}
                </div>
                <div className="col-span-4 text-muted-foreground text-center flex items-center justify-center gap-2">
                  <X className="h-4 w-4 text-rose-500 shrink-0 hidden sm:inline" />
                  <span>{row.traditional}</span>
                </div>
                <div className="col-span-4 font-semibold text-foreground text-center flex items-center justify-center gap-2 bg-primary/5 py-2 rounded-xl">
                  <Check className="h-4 w-4 text-primary shrink-0 hidden sm:inline" />
                  <span className="text-primary font-bold">{row.blynta}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

