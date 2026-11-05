"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Flame,
  Crop,
  Type,
  Wand2,
  CheckCircle2,
  Play,
  Volume2,
  Sparkles,
} from "lucide-react";

const showcaseTabs = [
  {
    id: "virality",
    label: "Virality Scorer",
    icon: Flame,
    title: "Pinpoint viral hooks before you even hit publish",
    description:
      "Blynta breaks down hours of conversation into second-by-second sentiment and retention heatmaps. Never wonder where the best clip is hiding.",
  },
  {
    id: "reframe",
    label: "Smart Reframing",
    icon: Crop,
    title: "Autonomous camera director with multi-speaker tracking",
    description:
      "Active speaker recognition dynamically pans, cuts, and switches. When two people debate, it smoothly splits the screen so viewers never miss a reaction.",
  },
  {
    id: "captions",
    label: "Karaoke Captions",
    icon: Type,
    title: "Retention-boosting animated captions with auto-emojis",
    description:
      "Over 75% of viewers watch mobile shorts on mute. Our word-by-word highlighted captions ensure your message is impossible to scroll past.",
  },
  {
    id: "prompter",
    label: "Natural Language AI Studio",
    icon: Wand2,
    title: "Direct your edits using plain English prompts",
    description:
      "No complex keyframes or multi-track timelines. Chat with Blynta to swap scenes, trim seconds, or tweak colors in real-time.",
  },
];

export function InteractiveShowcase() {
  const [activeTab, setActiveTab] = useState("virality");
  const [selectedCaptionStyle, setSelectedCaptionStyle] = useState("hormozi");
  const [activeHook, setActiveHook] = useState(0);

  const currentTab =
    showcaseTabs.find((t) => t.id === activeTab) || showcaseTabs[0];

  return (
    <section
      id="showcase"
      className="py-20 sm:py-28 bg-muted/20 border-y border-border"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-14">
          <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3">
            INTELLIGENT WORKSPACE
          </p>
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-foreground mb-4">
            A full creative agency inside a single browser tab.
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
            See how Blynta automates every step of short-form production, from
            transcription to final 4K render.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-10">
          {showcaseTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`relative inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                    : "bg-card border border-border text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Interactive Workspace Panel */}
        <div className="rounded-3xl border border-border bg-card p-6 sm:p-10 shadow-xl relative overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Left Column: Context & Bullet Points (5 cols) */}
            <div className="lg:col-span-5 flex flex-col justify-center text-left">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentTab.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.25 }}
                >
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/25 px-3 py-1 text-xs font-bold text-primary uppercase tracking-wider mb-4">
                    <Sparkles className="h-3.5 w-3.5" />
                    Feature Spotlight
                  </span>
                  <h3 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight mb-4 leading-tight">
                    {currentTab.title}
                  </h3>
                  <p className="text-sm sm:text-base text-muted-foreground leading-relaxed mb-6">
                    {currentTab.description}
                  </p>

                  <div className="space-y-3 border-t border-border/60 pt-6">
                    <div className="flex items-center gap-2.5 text-xs sm:text-sm text-foreground">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      <span>
                        Zero quality degradation with lossless GPU pipeline
                      </span>
                    </div>
                    <div className="flex items-center gap-2.5 text-xs sm:text-sm text-foreground">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      <span>
                        Instant sync with TikTok, Reels, and YouTube Shorts
                      </span>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Right Column: Live Interactive Sandbox (7 cols) */}
            <div className="lg:col-span-7">
              <div className="rounded-2xl border border-border bg-muted/40 p-5 sm:p-6 shadow-inner">
                {activeTab === "virality" && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="font-bold text-foreground">
                        Audio Sentiment & Retention Graph
                      </span>
                      <span className="font-mono text-primary">
                        High Confidence
                      </span>
                    </div>

                    {/* Interactive Heatmap Bar */}
                    <div className="h-32 rounded-xl bg-card border border-border p-3 flex items-end justify-between gap-1 sm:gap-2">
                      {[
                        { score: 45, reason: "Introduction banter" },
                        { score: 55, reason: "Context setting" },
                        {
                          score: 98,
                          reason:
                            "🔥 Viral Revelation: 'Stop hiring before $1M ARR'",
                        },
                        { score: 62, reason: "Audience question" },
                        {
                          score: 91,
                          reason:
                            "⚡ Contrarian Insight: 'Why coding alone is a trap'",
                        },
                        { score: 70, reason: "Discussion recap" },
                        {
                          score: 86,
                          reason: "💡 Tactical Framework for Growth",
                        },
                        { score: 50, reason: "Closing remarks" },
                      ].map((bar, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setActiveHook(idx)}
                          className={`flex-1 rounded-t-md transition-all cursor-pointer relative group ${
                            activeHook === idx
                              ? "bg-primary shadow-lg shadow-primary/40"
                              : bar.score > 80
                                ? "bg-primary/50 hover:bg-primary/70"
                                : "bg-muted-foreground/20 hover:bg-muted-foreground/35"
                          }`}
                          style={{ height: `${bar.score}%` }}
                        >
                          {bar.score > 80 && (
                            <span className="absolute -top-6 left-1/2 -translate-x-1/2 font-mono text-[10px] font-bold text-primary">
                              {bar.score}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>

                    {/* Active Hook Insight Box */}
                    <div className="rounded-xl border border-primary/25 bg-card p-4 text-left shadow-xs">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                          <Flame className="h-4 w-4 fill-primary" />
                          Selected Segment Analysis
                        </span>
                        <span className="font-mono text-xs font-bold text-foreground">
                          Timestamp 14:12 - 14:58
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                        Strong curiosity gap detected. Vocal inflection and pace
                        increased by 28%, signaling peak listener retention and
                        high shareability.
                      </p>
                    </div>
                  </div>
                )}

                {activeTab === "reframe" && (
                  <div className="space-y-4 text-left">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="font-bold text-foreground">
                        Neural Speaker Framing Engine
                      </span>
                      <span className="font-mono text-emerald-500">
                        Dual-Speaker Mode
                      </span>
                    </div>

                    {/* Visual Comparison Stage */}
                    <div className="grid grid-cols-2 gap-4">
                      {/* 16:9 Raw Frame */}
                      <div className="rounded-xl border border-border bg-card p-3 flex flex-col justify-between aspect-video">
                        <div className="flex justify-between items-center text-[10px] text-muted-foreground font-mono">
                          <span>Original 16:9</span>
                          <span className="text-amber-500">Uncropped</span>
                        </div>
                        <div className="h-12 w-full rounded border border-dashed border-primary/50 flex items-center justify-center text-[11px] text-primary font-mono">
                          Speaker A & B wide shot
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          50% negative dead space
                        </span>
                      </div>

                      {/* 9:16 Blynta Frame */}
                      <div className="rounded-xl border border-primary bg-primary/5 p-3 flex flex-col justify-between aspect-video">
                        <div className="flex justify-between items-center text-[10px] text-primary font-mono font-bold">
                          <span>Blynta 9:16 Split</span>
                          <span className="text-emerald-500">Active Lock</span>
                        </div>
                        <div className="h-12 w-full rounded bg-primary/20 flex items-center justify-center text-[11px] text-foreground font-bold font-mono">
                          Stacked Dual Reaction
                        </div>
                        <span className="text-[10px] text-primary font-medium">
                          100% viewport utilization
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      Blynta automatically determines whether to crop to a
                      single speaker or generate a dynamic split-screen based on
                      conversation rhythm.
                    </p>
                  </div>
                )}

                {activeTab === "captions" && (
                  <div className="space-y-4 text-left">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="font-bold text-foreground">
                        Select Animated Caption Archetype
                      </span>
                      <span className="text-primary font-mono text-[11px]">
                        Preview Live
                      </span>
                    </div>

                    {/* Subtitle Style Switcher Buttons */}
                    <div className="flex flex-wrap gap-2">
                      {[
                        { id: "hormozi", label: "🔥 Hormozi Pop" },
                        { id: "minimal", label: "✨ Minimalist Clean" },
                        { id: "neon", label: "⚡ Cyber Neon" },
                        { id: "bold-red", label: "🎯 Red Punch" },
                      ].map((style) => (
                        <button
                          key={style.id}
                          type="button"
                          onClick={() => setSelectedCaptionStyle(style.id)}
                          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                            selectedCaptionStyle === style.id
                              ? "bg-primary text-primary-foreground shadow-xs"
                              : "border border-border bg-card text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          {style.label}
                        </button>
                      ))}
                    </div>

                    {/* Subtitle Interactive Sandbox */}
                    <div className="h-28 rounded-xl bg-slate-950 border border-white/10 p-4 flex items-center justify-center text-center">
                      {selectedCaptionStyle === "hormozi" && (
                        <p className="text-base sm:text-lg font-black tracking-tight text-white uppercase">
                          The secret is{" "}
                          <span className="bg-yellow-400 text-black px-1.5 py-0.5 rounded shadow-sm inline-block">
                            CONSISTENCY
                          </span>{" "}
                          over perfection!
                        </p>
                      )}
                      {selectedCaptionStyle === "minimal" && (
                        <p className="text-sm sm:text-base font-medium text-white/95 tracking-wide">
                          The secret is{" "}
                          <span className="text-sky-400 font-semibold underline decoration-2">
                            consistency
                          </span>{" "}
                          over perfection.
                        </p>
                      )}
                      {selectedCaptionStyle === "neon" && (
                        <p className="text-base sm:text-lg font-extrabold text-cyan-300 drop-shadow-[0_0_12px_rgba(6,182,212,0.8)] uppercase tracking-wider font-mono">
                          THE SECRET IS [CONSISTENCY]!
                        </p>
                      )}
                      {selectedCaptionStyle === "bold-red" && (
                        <p className="text-base sm:text-lg font-black text-white uppercase tracking-tight">
                          The secret is{" "}
                          <span className="bg-red-600 text-white px-2 py-0.5 rounded font-black inline-block">
                            CONSISTENCY!
                          </span>
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === "prompter" && (
                  <div className="space-y-4 text-left">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="font-bold text-foreground">
                        AI Studio Command Interface
                      </span>
                      <span className="font-mono text-primary">
                        Natural Language
                      </span>
                    </div>

                    {/* Chat Prompt Simulator */}
                    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                      <div className="flex items-start gap-2.5">
                        <div className="h-6 w-6 rounded-full bg-primary/20 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                          U
                        </div>
                        <div className="rounded-xl bg-muted/60 p-2.5 text-xs text-foreground">
                          &ldquo;Cut out the 2-second hesitation at 0:12, zoom
                          in 15% when he mentions the \$1M figure, and add a
                          cash register sound.&rdquo;
                        </div>
                      </div>

                      <div className="flex items-start gap-2.5">
                        <div className="h-6 w-6 rounded-full bg-primary text-white font-bold text-xs flex items-center justify-center shrink-0">
                          B
                        </div>
                        <div className="rounded-xl bg-primary/10 border border-primary/20 p-2.5 text-xs text-primary font-medium">
                          ✓ Trimmed 2.1s pause • Zoom applied at 0:10 • SFX
                          inserted. Render ready in 4 seconds.
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      Control edits just like you would instruct a human
                      assistant editor.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
