"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Zap,
  Play,
  Flame,
  Volume2,
  CheckCircle2,
  Maximize2,
  Heart,
  MessageCircle,
  Share2,
} from "lucide-react";
import { siteConfig } from "../lib/site";

export function Hero() {
  const [videoUrl, setVideoUrl] = useState(
    "https://youtube.com/watch?v=v0L1x_lexfridman",
  );
  const [selectedStyle, setSelectedStyle] = useState("high-energy");
  const [isPlaying, setIsPlaying] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const targetUrl = `${siteConfig.appUrl}/login?videoUrl=${encodeURIComponent(
      videoUrl,
    )}&style=${encodeURIComponent(selectedStyle)}`;
    window.location.href = targetUrl;
  };

  return (
    <section className="relative overflow-hidden pt-12 pb-24 md:pt-20 md:pb-32 bg-grid-pattern">
      {/* Dynamic ambient background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[780px] max-w-[95vw] h-[480px] rounded-full radial-glow pointer-events-none blur-3xl opacity-80" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col items-center text-center">
        {/* Floating Release Badge */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary shadow-sm mb-6"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
          </span>
          <span>Blynta 2.0 • Autonomous Video to Shorts Engine</span>
        </motion.div>

        {/* Hero Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
          className="text-4xl sm:text-6xl lg:text-7xl xl:text-[80px] font-black tracking-tight text-foreground max-w-5xl leading-[1.04] mb-6"
        >
          Turn 1 hour of footage into{" "}
          <span className="bg-gradient-to-r from-primary via-indigo-500 to-violet-600 bg-clip-text text-transparent">
            10 viral shorts
          </span>{" "}
          in 60 seconds.
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
          className="text-base sm:text-lg lg:text-xl text-muted-foreground max-w-2xl mb-10 leading-relaxed font-normal"
        >
          Paste any YouTube or podcast link. Blynta&apos;s neural models extract
          high-retention hooks, reframe horizontal clips to vertical 9:16 with
          face-tracking, and burn dynamic animated captions.
        </motion.p>

        {/* Interactive URL Engine Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
          className="w-full max-w-3xl rounded-2xl border border-primary/25 bg-card/90 backdrop-blur-xl p-4 sm:p-6 shadow-2xl shadow-primary/10 text-left relative"
        >
          {/* Subtle top edge highlight */}
          <div className="absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-gradient-to-r from-primary/20 via-primary to-primary/20" />

          <form
            onSubmit={handleSubmit}
            className="flex flex-col sm:flex-row gap-3 mb-4"
          >
            <div className="relative flex-1">
              <input
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="Paste any YouTube or Vimeo video URL..."
                aria-label="Video URL input"
                className="w-full rounded-xl border border-border bg-muted/30 px-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                required
              />
            </div>
            <button
              type="submit"
              className="group inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-7 py-3.5 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/25 hover:bg-primary/90 transition-all hover:-translate-y-0.5 active:translate-y-0 whitespace-nowrap cursor-pointer"
            >
              <span>Generate Shorts Free</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </button>
          </form>

          {/* Quick-fill Sample Video Links */}
          <div className="flex flex-wrap items-center gap-2 mb-4 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground/80">
              Try sample:
            </span>
            {siteConfig.samples.map((sample) => (
              <button
                key={sample.label}
                type="button"
                onClick={() => setVideoUrl(sample.url)}
                className="rounded-lg border border-border/80 bg-muted/40 px-2.5 py-1 text-xs hover:border-primary/50 hover:bg-muted transition-colors cursor-pointer"
              >
                {sample.label}
              </button>
            ))}
          </div>

          {/* Style Archetypes Selector */}
          <div className="pt-3 border-t border-border/50 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground mr-1">
                AI Tone Archetype:
              </span>
              {siteConfig.stylePresets.map((style) => {
                const isActive = selectedStyle === style.id;
                return (
                  <button
                    key={style.id}
                    type="button"
                    onClick={() => setSelectedStyle(style.id)}
                    className={`relative inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all cursor-pointer ${
                      isActive
                        ? "border border-primary bg-primary/15 text-primary font-semibold shadow-xs"
                        : "border border-border/70 bg-muted/20 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    }`}
                  >
                    <span>{style.label}</span>
                    {style.pro && (
                      <span className="rounded bg-primary/20 px-1 py-0.2 text-[9px] font-bold uppercase text-primary">
                        PRO
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Zap className="h-3.5 w-3.5 text-primary" />
              <span>Includes 60 free processing credits</span>
            </div>
          </div>
        </motion.div>

        {/* Trust Badges */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-6 flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground"
        >
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            No credit card required
          </span>
          <span className="text-border hidden sm:inline">•</span>
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            Commercial rights included
          </span>
          <span className="text-border hidden sm:inline">•</span>
          <span className="inline-flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-amber-500" />
            Exports in full 4K 60FPS
          </span>
        </motion.div>

        {/* ================= HERO SHOWCASE: BEFORE & AFTER STAGE ================= */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.45, ease: "easeOut" }}
          className="mt-16 w-full max-w-6xl rounded-3xl border border-border bg-card/60 backdrop-blur-2xl p-4 sm:p-8 shadow-2xl shadow-primary/5"
        >
          {/* Stage Top Bar */}
          <div className="flex items-center justify-between border-b border-border/70 pb-4 mb-6 text-left">
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5">
                <div className="h-3 w-3 rounded-full bg-rose-500/80" />
                <div className="h-3 w-3 rounded-full bg-amber-500/80" />
                <div className="h-3 w-3 rounded-full bg-emerald-500/80" />
              </div>
              <span className="font-mono text-xs text-muted-foreground">
                blynta-neural-pipeline // job_id: #8942-live
              </span>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 font-medium text-emerald-600 dark:text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                AI Inference Ready
              </span>
              <button
                type="button"
                onClick={() => setIsPlaying(!isPlaying)}
                className="rounded-lg border border-border bg-muted/60 px-2.5 py-1 text-xs font-medium hover:bg-muted cursor-pointer"
              >
                {isPlaying ? "Pause Preview" : "Play Preview"}
              </button>
            </div>
          </div>

          {/* Transformation Grid: 16:9 Source -> Neural Center -> 9:16 Vertical Short */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            {/* Left: 16:9 Raw Source Video Card (5 cols) */}
            <div className="lg:col-span-5 flex flex-col gap-3 text-left">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <Play className="h-3.5 w-3.5 text-primary fill-primary" />
                  Source Video (16:9 Landscape)
                </span>
                <span className="font-mono text-[11px]">
                  00:14:28 / 01:24:19
                </span>
              </div>

              {/* Video Mockup Frame */}
              <div className="relative aspect-video w-full rounded-2xl overflow-hidden border border-border bg-gradient-to-br from-slate-900 to-indigo-950 p-4 flex flex-col justify-between shadow-inner">
                {/* Simulated Podcast Scene */}
                <div className="absolute inset-0 flex items-center justify-center opacity-30">
                  <div className="w-full h-full bg-[radial-gradient(circle_at_30%_50%,rgba(79,110,247,0.4),transparent_60%)]" />
                </div>

                {/* Face Tracking Bounding Box */}
                <div className="relative z-10 w-28 sm:w-36 h-36 sm:h-44 border-2 border-primary/90 rounded-xl bg-primary/10 flex flex-col justify-between p-2">
                  <span className="rounded bg-primary px-1.5 py-0.5 text-[9px] font-mono font-bold text-white tracking-wider w-max">
                    SPEAKER 1 [LOCK]
                  </span>
                  <div className="flex justify-between items-end">
                    <span className="text-[10px] font-mono text-primary font-bold">
                      CONF: 99.4%
                    </span>
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                  </div>
                </div>

                {/* Source Audio Waveform */}
                <div className="relative z-10 w-full rounded-lg bg-black/60 backdrop-blur-md p-2.5 border border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[11px] text-white/80 font-mono">
                    <Volume2 className="h-3.5 w-3.5 text-primary" />
                    <span>Raw Audio Track</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {[12, 28, 45, 20, 60, 80, 45, 90, 70, 30, 85, 40, 20].map(
                      (h, i) => (
                        <span
                          key={i}
                          className={`w-1 rounded-full bg-primary/70 ${
                            isPlaying ? "animate-pulse" : ""
                          }`}
                          style={{ height: `${h * 0.22}px` }}
                        />
                      ),
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                <span>Format: 1920 × 1080 Widescreen</span>
                <span className="text-primary font-medium">
                  Auto-detected 14 clips
                </span>
              </div>
            </div>

            {/* Center: AI Neural Bridge (2 cols) */}
            <div className="lg:col-span-2 flex flex-col items-center justify-center py-4 lg:py-0">
              <div className="relative flex flex-col items-center gap-3">
                {/* Pulsing Neural Core */}
                <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary to-indigo-500 shadow-lg shadow-primary/30 text-white">
                  <Sparkles className="h-7 w-7 animate-spin-slow" />
                  <span className="absolute -inset-1 rounded-2xl border border-primary/40 animate-ping opacity-30" />
                </div>

                <div className="text-center">
                  <p className="text-xs font-bold text-foreground">
                    Blynta Engine
                  </p>
                  <p className="text-[10px] font-mono text-primary">
                    Autonomous Crop
                  </p>
                </div>

                {/* Animated progress indicators */}
                <div className="flex flex-col gap-1.5 w-32 text-[10px] text-muted-foreground font-mono">
                  <div className="flex items-center justify-between bg-muted/60 px-2 py-0.5 rounded border border-border">
                    <span>Hook Score</span>
                    <span className="font-bold text-primary">98 / 100</span>
                  </div>
                  <div className="flex items-center justify-between bg-muted/60 px-2 py-0.5 rounded border border-border">
                    <span>Reframe</span>
                    <span className="font-bold text-emerald-500">
                      9:16 Center
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Vertical 9:16 Output Phone Frame (5 cols) */}
            <div className="lg:col-span-5 flex flex-col items-center lg:items-start text-left">
              <div className="w-full max-w-[280px] sm:max-w-[310px] mx-auto rounded-[32px] border-4 border-foreground/15 bg-slate-950 p-2 shadow-2xl relative overflow-hidden">
                {/* Phone Speaker Notch */}
                <div className="absolute top-3 left-1/2 -translate-x-1/2 w-20 h-4 bg-foreground/20 rounded-full z-30" />

                {/* Inner Screen 9:16 */}
                <div className="relative aspect-[9/16] w-full rounded-[24px] overflow-hidden bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-950 flex flex-col justify-between p-4">
                  {/* Top Overlay: Virality Badge */}
                  <div className="relative z-20 flex items-center justify-between pt-4">
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 backdrop-blur-md border border-amber-500/40 px-2.5 py-1 text-[11px] font-bold text-amber-400">
                      <Flame className="h-3 w-3 fill-amber-400" />
                      <span>98% Viral Potential</span>
                    </span>
                    <span className="rounded-full bg-black/40 backdrop-blur-md px-2 py-0.5 text-[10px] font-mono text-white/80">
                      00:38 HD
                    </span>
                  </div>

                  {/* Center: Dynamic Animated Subtitles (Karaoke Hormozi Style) */}
                  <div className="relative z-20 text-center my-auto px-2">
                    <div className="inline-block rounded-xl bg-black/60 backdrop-blur-md px-3 py-2 border border-white/10 shadow-lg">
                      <p className="text-base sm:text-lg font-black tracking-tight text-white leading-snug">
                        &ldquo;THIS ONE STRATEGY{" "}
                        <span className="bg-yellow-400 text-black px-1.5 py-0.5 rounded font-black inline-block transform -rotate-1 shadow-md">
                          CHANGED EVERYTHING
                        </span>{" "}
                        FOR OUR BUSINESS!&rdquo;
                      </p>
                    </div>
                  </div>

                  {/* Right Action Stack (TikTok/Reels Simulation) */}
                  <div className="absolute right-3 bottom-16 z-20 flex flex-col items-center gap-3 text-white">
                    <div className="flex flex-col items-center gap-0.5">
                      <div className="h-8 w-8 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center">
                        <Heart className="h-4 w-4 fill-rose-500 text-rose-500" />
                      </div>
                      <span className="text-[10px] font-bold font-mono">
                        184K
                      </span>
                    </div>

                    <div className="flex flex-col items-center gap-0.5">
                      <div className="h-8 w-8 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center">
                        <MessageCircle className="h-4 w-4 text-white" />
                      </div>
                      <span className="text-[10px] font-bold font-mono">
                        2.4K
                      </span>
                    </div>

                    <div className="flex flex-col items-center gap-0.5">
                      <div className="h-8 w-8 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center">
                        <Share2 className="h-4 w-4 text-white" />
                      </div>
                      <span className="text-[10px] font-bold font-mono">
                        48K
                      </span>
                    </div>
                  </div>

                  {/* Bottom Video Metadata */}
                  <div className="relative z-20 flex items-center justify-between text-[11px] text-white/90 bg-black/50 backdrop-blur-md p-2 rounded-xl border border-white/10">
                    <div className="flex items-center gap-2">
                      <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center font-bold text-[9px] text-white">
                        B
                      </div>
                      <span className="font-semibold truncate max-w-[130px]">
                        @growth_secrets
                      </span>
                    </div>
                    <span className="text-emerald-400 font-bold text-[10px]">
                      Ready to Publish
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
