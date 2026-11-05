"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import { siteConfig } from "../lib/site";

export function CtaBanner() {
  const [quickUrl, setQuickUrl] = useState("");
  const signupUrl = `${siteConfig.appUrl}/signup`;

  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (quickUrl.trim()) {
      window.location.href = `${siteConfig.appUrl}/login?videoUrl=${encodeURIComponent(
        quickUrl.trim(),
      )}`;
    } else {
      window.location.href = signupUrl;
    }
  };

  return (
    <section className="relative overflow-hidden py-24 sm:py-36 bg-background border-t border-border text-center">
      {/* Background radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] max-w-[95vw] h-[450px] rounded-full radial-glow pointer-events-none blur-3xl opacity-90" />

      <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary mb-6 shadow-xs">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Launch Your Growth Engine</span>
        </div>

        <h2 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-foreground leading-[1.05] mb-6">
          Ready to turn your backlog into{" "}
          <span className="bg-gradient-to-r from-primary via-indigo-500 to-violet-600 bg-clip-text text-transparent">
            viral shorts?
          </span>
        </h2>

        <p className="text-base sm:text-xl text-muted-foreground max-w-xl mx-auto leading-relaxed mb-10 font-normal">
          Join thousands of smart creators publishing 10x more content in 90%
          less time. Your first batch of clips is completely free.
        </p>

        {/* Quick Launch Bar */}
        <form
          onSubmit={handleQuickSubmit}
          className="max-w-xl mx-auto flex flex-col sm:flex-row gap-3 mb-8"
        >
          <input
            type="url"
            value={quickUrl}
            onChange={(e) => setQuickUrl(e.target.value)}
            placeholder="Paste your video URL here..."
            className="flex-1 rounded-xl border border-border bg-card/80 backdrop-blur-md px-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-xs"
          />
          <button
            type="submit"
            className="group inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-8 py-3.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 hover:bg-primary/90 transition-all hover:-translate-y-0.5 active:translate-y-0 whitespace-nowrap cursor-pointer"
          >
            <span>Start Generating Free</span>
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </button>
        </form>

        <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground font-medium">
          <div className="inline-flex items-center gap-1.5">
            <Check className="h-4 w-4 text-primary" />
            <span>No credit card required</span>
          </div>
          <span className="text-border hidden sm:inline">•</span>
          <div className="inline-flex items-center gap-1.5">
            <Check className="h-4 w-4 text-primary" />
            <span>60 Free Starter Credits</span>
          </div>
          <span className="text-border hidden sm:inline">•</span>
          <div className="inline-flex items-center gap-1.5">
            <Check className="h-4 w-4 text-primary" />
            <span>Full Commercial Rights</span>
          </div>
        </div>
      </div>
    </section>
  );
}
