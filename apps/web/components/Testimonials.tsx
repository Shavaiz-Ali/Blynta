import React from "react";
import { Star, CheckCircle2, TrendingUp } from "lucide-react";
import { siteConfig } from "../lib/site";

export function Testimonials() {
  return (
    <section className="py-20 sm:py-28 bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3">
            VERIFIED CREATOR STORIES
          </p>
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-foreground mb-4">
            Powering channels that ship daily.
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
            See how top creators, stream networks, and media brands use Blynta
            to dominate mobile video feeds.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
          {siteConfig.testimonials.map((t) => (
            <div
              key={t.name}
              className="flex flex-col justify-between rounded-3xl border border-border bg-card p-8 shadow-sm transition-all duration-200 hover:-translate-y-1.5 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5"
            >
              <div>
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-1 text-amber-500">
                    {Array.from({ length: t.stars }).map((_, i) => (
                      <Star
                        key={i}
                        className="h-4 w-4 fill-amber-500 text-amber-500"
                      />
                    ))}
                  </div>

                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-500 font-mono bg-emerald-500/10 px-2 py-0.5 rounded-full">
                    <TrendingUp className="h-3 w-3" />
                    {t.views}
                  </span>
                </div>

                <blockquote className="text-sm sm:text-[15px] text-foreground leading-relaxed italic mb-8">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>
              </div>

              <div className="flex items-center gap-3.5 border-t border-border/60 pt-5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary to-indigo-500 font-bold text-sm text-white shadow-md shadow-primary/20">
                  {t.initials}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-bold text-foreground leading-tight">
                      {t.name}
                    </p>
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t.role}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
