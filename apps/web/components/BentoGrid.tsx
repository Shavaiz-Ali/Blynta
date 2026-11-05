"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  Sparkles,
  Zap,
  Camera,
  Layers,
  BarChart3,
  Flame,
  Globe2,
  Cpu,
} from "lucide-react";
import { siteConfig } from "../lib/site";

export function BentoGrid() {
  return (
    <section id="features" className="py-20 sm:py-28 bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3">
            ARCHITECTURAL SUPERPOWERS
          </p>
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-foreground mb-4">
            Built from the ground up for virality.
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
            Every feature is engineered to maximize audience watch-time, viewer
            retention, and algorithmic distribution.
          </p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Multi-Speaker Face Tracking (Span 2 cols) */}
          <motion.div
            whileHover={{ y: -4 }}
            transition={{ duration: 0.2 }}
            className="md:col-span-2 rounded-3xl border border-border bg-card p-8 shadow-sm flex flex-col justify-between relative overflow-hidden group hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5"
          >
            <div className="relative z-10">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 text-primary mb-6">
                <Camera className="h-6 w-6" />
              </div>

              <div className="flex items-center gap-2 mb-2">
                <span className="font-mono text-xs uppercase tracking-wider font-bold text-primary">
                  Neural Computer Vision
                </span>
                <span className="rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 text-[10px] font-bold">
                  99.8% Accuracy
                </span>
              </div>

              <h3 className="text-2xl font-bold text-foreground mb-3">
                Active Speaker Multi-Angle Tracking
              </h3>

              <p className="text-sm sm:text-base text-muted-foreground max-w-xl leading-relaxed mb-8">
                Say goodbye to awkward manual keyframing. Blynta detects who is speaking
                in horizontal video, smoothly tracks their head movements, and crops them
                into 9:16 portrait. When guests converse, it creates seamless two-box cuts.
              </p>
            </div>

            {/* Interactive Visual Graphic */}
            <div className="relative z-10 w-full rounded-2xl border border-border/80 bg-muted/30 p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary font-mono font-bold text-sm">
                  AI
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">
                    Automated Camera Director
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Real-time speaker switch • Zero stutter
                  </p>
                </div>
              </div>

              <span className="rounded-full bg-primary/10 border border-primary/20 px-3 py-1 text-xs font-semibold text-primary">
                Active Tracking
              </span>
            </div>
          </motion.div>

          {/* Card 2: AI Hook & Sentiment Scorer (Span 1 col) */}
          <motion.div
            whileHover={{ y: -4 }}
            transition={{ duration: 0.2 }}
            className="rounded-3xl border border-border bg-card p-8 shadow-sm flex flex-col justify-between relative overflow-hidden group hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5"
          >
            <div>
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 mb-6">
                <Flame className="h-6 w-6" />
              </div>

              <span className="font-mono text-xs uppercase tracking-wider font-bold text-amber-500 block mb-2">
                Predictive Virality
              </span>

              <h3 className="text-xl font-bold text-foreground mb-3">
                Algorithmic Hook Scoring
              </h3>

              <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                Scores every moment from 0 to 100 based on curiosity gaps, voice
                energy, and historical retention benchmarks.
              </p>
            </div>

            {/* Virality Meter Graphic */}
            <div className="rounded-2xl border border-border bg-muted/40 p-4">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-semibold text-foreground">Viral Index</span>
                <span className="font-mono font-bold text-amber-500">98 / 100</span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-rose-500 w-[98%]" />
              </div>
            </div>
          </motion.div>

          {/* Card 3: Dynamic Animated Subtitles (Span 1 col) */}
          <motion.div
            whileHover={{ y: -4 }}
            transition={{ duration: 0.2 }}
            className="rounded-3xl border border-border bg-card p-8 shadow-sm flex flex-col justify-between relative overflow-hidden group hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5"
          >
            <div>
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 mb-6">
                <Layers className="h-6 w-6" />
              </div>

              <span className="font-mono text-xs uppercase tracking-wider font-bold text-indigo-500 block mb-2">
                Karaoke Text Engine
              </span>

              <h3 className="text-xl font-bold text-foreground mb-3">
                Dynamic Animated Captions
              </h3>

              <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                Auto-transcribe in 50+ languages with 99.4% accuracy. Add dynamic
                animated karaoke highlights, custom brand fonts, and emojis.
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-muted/40 p-3.5 text-center">
              <span className="text-xs font-black tracking-tight text-foreground uppercase">
                &ldquo;WATCH RETENTION{" "}
                <span className="bg-primary text-primary-foreground px-1.5 py-0.5 rounded">
                  DOUBLE!
                </span>
                &rdquo;
              </span>
            </div>
          </motion.div>

          {/* Card 4: Cloud GPU 4K Render Engine (Span 2 cols) */}
          <motion.div
            whileHover={{ y: -4 }}
            transition={{ duration: 0.2 }}
            className="md:col-span-2 rounded-3xl border border-border bg-card p-8 shadow-sm flex flex-col justify-between relative overflow-hidden group hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5"
          >
            <div>
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 mb-6">
                <Cpu className="h-6 w-6" />
              </div>

              <div className="flex items-center gap-2 mb-2">
                <span className="font-mono text-xs uppercase tracking-wider font-bold text-emerald-500">
                  Cloud Infrastructure
                </span>
                <span className="rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 text-[10px] font-bold">
                  10x Real-time
                </span>
              </div>

              <h3 className="text-2xl font-bold text-foreground mb-3">
                Ultra 4K 60FPS Cloud Render Pipeline
              </h3>

              <p className="text-sm sm:text-base text-muted-foreground max-w-xl leading-relaxed mb-8">
                Export crystalline 4K clips without spinning up loud fans or freezing your
                laptop. Blynta&apos;s distributed GPU render cluster finishes a 10-clip
                batch in under 90 seconds.
              </p>
            </div>

            {/* Pipeline Status Bar */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl border border-border bg-muted/40 p-3">
                <p className="font-mono text-lg font-black text-foreground">4K 60FPS</p>
                <p className="text-[10px] text-muted-foreground uppercase">Maximum Fidelity</p>
              </div>
              <div className="rounded-xl border border-border bg-muted/40 p-3">
                <p className="font-mono text-lg font-black text-foreground">&lt; 90s</p>
                <p className="text-[10px] text-muted-foreground uppercase">Average Batch Time</p>
              </div>
              <div className="rounded-xl border border-border bg-muted/40 p-3">
                <p className="font-mono text-lg font-black text-foreground">50+ Langs</p>
                <p className="text-[10px] text-muted-foreground uppercase">Global Reach</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

