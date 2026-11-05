"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Calculator, ArrowRight, Clock, DollarSign, Video } from "lucide-react";
import { siteConfig } from "../lib/site";

export function RoiCalculator() {
  const [videosPerMonth, setVideosPerMonth] = useState(4);
  const [hoursPerVideo, setHoursPerVideo] = useState(4);

  const hoursSaved = videosPerMonth * hoursPerVideo;
  const costSaved = hoursSaved * 50; // assuming $50/hr agency/editor rate
  const shortsGenerated = videosPerMonth * 8; // average 8 shorts per long-form video

  const signupUrl = `${siteConfig.appUrl}/signup`;

  return (
    <section
      id="calculator"
      className="py-20 sm:py-28 bg-muted/20 border-y border-border"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3">
            ROI CALCULATOR
          </p>
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-foreground mb-4">
            How much time and money will Blynta save you?
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
            Adjust the sliders below to calculate your estimated monthly savings
            and content output increase.
          </p>
        </div>

        {/* Calculator Card */}
        <div className="max-w-4xl mx-auto rounded-3xl border border-border bg-card p-6 sm:p-10 shadow-xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            {/* Sliders (6 cols) */}
            <div className="lg:col-span-6 space-y-8 text-left">
              {/* Slider 1: Videos per month */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <label
                    htmlFor="videos-range"
                    className="text-sm font-bold text-foreground"
                  >
                    Long videos produced per month:
                  </label>
                  <span className="font-mono text-lg font-black text-primary px-3 py-1 rounded-lg bg-primary/10 border border-primary/20">
                    {videosPerMonth} videos
                  </span>
                </div>
                <input
                  id="videos-range"
                  type="range"
                  min="1"
                  max="16"
                  value={videosPerMonth}
                  onChange={(e) => setVideosPerMonth(Number(e.target.value))}
                  className="w-full h-2 rounded-lg bg-muted appearance-none cursor-pointer accent-primary"
                />
                <div className="flex justify-between text-[11px] text-muted-foreground mt-1">
                  <span>1 / month</span>
                  <span>16 / month</span>
                </div>
              </div>

              {/* Slider 2: Hours spent per video */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <label
                    htmlFor="hours-range"
                    className="text-sm font-bold text-foreground"
                  >
                    Hours spent manually clipping each video:
                  </label>
                  <span className="font-mono text-lg font-black text-primary px-3 py-1 rounded-lg bg-primary/10 border border-primary/20">
                    {hoursPerVideo} hours
                  </span>
                </div>
                <input
                  id="hours-range"
                  type="range"
                  min="1"
                  max="10"
                  value={hoursPerVideo}
                  onChange={(e) => setHoursPerVideo(Number(e.target.value))}
                  className="w-full h-2 rounded-lg bg-muted appearance-none cursor-pointer accent-primary"
                />
                <div className="flex justify-between text-[11px] text-muted-foreground mt-1">
                  <span>1 hr</span>
                  <span>10 hrs</span>
                </div>
              </div>

              <div className="rounded-xl border border-border/80 bg-muted/40 p-4 text-xs text-muted-foreground leading-relaxed">
                💡 <strong>Based on creator data:</strong> Most editors spend
                30-45 minutes per short clip finding moments, keyframing, and
                formatting subtitles. Blynta cuts that down to 1 click.
              </div>
            </div>

            {/* Results Output (6 cols) */}
            <div className="lg:col-span-6 rounded-2xl border border-primary/30 bg-gradient-to-b from-primary/10 via-card to-card p-6 sm:p-8 flex flex-col justify-between text-left shadow-lg">
              <div className="space-y-6">
                <div>
                  <span className="text-xs uppercase font-bold tracking-wider text-primary">
                    Estimated Monthly Impact
                  </span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-4xl sm:text-5xl font-black text-foreground tracking-tight font-mono">
                      {hoursSaved} hrs
                    </span>
                    <span className="text-sm text-muted-foreground font-semibold">
                      reclaimed / month
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 border-t border-border/60 pt-6">
                  <div className="rounded-xl bg-card border border-border p-3.5">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                      <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
                      <span>Editing Cost Saved</span>
                    </div>
                    <p className="font-mono text-xl font-bold text-foreground">
                      ${costSaved.toLocaleString()}
                    </p>
                  </div>

                  <div className="rounded-xl bg-card border border-border p-3.5">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                      <Video className="h-3.5 w-3.5 text-primary" />
                      <span>Shorts Generated</span>
                    </div>
                    <p className="font-mono text-xl font-bold text-foreground">
                      ~{shortsGenerated} clips
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-8">
                <Link
                  href={signupUrl}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/25 hover:bg-primary/90 transition-all hover:-translate-y-0.5 active:translate-y-0"
                >
                  <span>Reclaim {hoursSaved} Hours Free</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
