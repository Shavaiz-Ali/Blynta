"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BlyntaLogo } from "@/components/logo";
import { AppButton } from "@/components/common/AppButton";
import { ThemeToggle } from "@/components/common/ThemeToggle";

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="min-h-screen w-full flex flex-col bg-background text-foreground relative overflow-hidden selection:bg-primary/20">
      {/* ── Ambient Background Glow & Grid ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[450px] bg-primary/10 rounded-full blur-[120px]" />
        <div className="absolute top-1/2 -left-40 w-[500px] h-[350px] bg-chart-4/10 rounded-full blur-[100px]" />
        <div className="absolute -bottom-20 -right-20 w-[600px] h-[400px] bg-primary/10 rounded-full blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
          style={{
            backgroundImage: `radial-gradient(currentColor 1px, transparent 1px)`,
            backgroundSize: "24px 24px",
          }}
        />
      </div>

      {/* ── Top Navigation Bar ── */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex items-center justify-between">
        <Link href="/dashboard" className="transition-opacity hover:opacity-90">
          <BlyntaLogo size="md" />
        </Link>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link href="/dashboard">
            <AppButton variant="outline" size="sm" className="hidden sm:inline-flex">
              Dashboard
            </AppButton>
          </Link>
        </div>
      </header>

      {/* ── Main 404 Hero Section ── */}
      <main className="flex-1 relative z-10 flex flex-col items-center justify-center px-4 sm:px-6 text-center py-12">
        <div className="max-w-2xl mx-auto flex flex-col items-center space-y-6">
          {/* Status Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-card/80 border border-primary/20 text-xs font-medium text-foreground shadow-sm backdrop-blur-md animate-in fade-in zoom-in-90 duration-300">
            <span className="flex h-2 w-2 rounded-full bg-destructive animate-pulse" />
            <span className="font-mono text-[11px] font-bold tracking-wider uppercase text-muted-foreground">
              ERROR 404 • SCENE NOT FOUND
            </span>
          </div>

          {/* Stylized 404 Number with Video Reel Cutout */}
          <div className="relative select-none my-2">
            <h1 className="text-8xl sm:text-9xl lg:text-[11rem] font-black tracking-tighter leading-none bg-gradient-to-b from-foreground via-foreground/70 to-foreground/20 bg-clip-text text-transparent">
              404
            </h1>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="p-3 rounded-2xl bg-card/90 border border-border/80 shadow-2xl backdrop-blur-xl text-primary animate-bounce duration-1000">
                <svg
                  className="h-8 w-8 sm:h-10 sm:w-10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect width="18" height="18" x="3" y="3" rx="2" />
                  <path d="M7 3v18" />
                  <path d="M3 7.5h4" />
                  <path d="M3 12h18" />
                  <path d="M3 16.5h4" />
                  <path d="M17 3v18" />
                  <path d="M17 7.5h4" />
                  <path d="M17 16.5h4" />
                </svg>
              </div>
            </div>
          </div>

          {/* Heading & Subtitle */}
          <div className="space-y-3">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              This clip was cut on the editing floor.
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground max-w-md mx-auto leading-relaxed">
              The page you are looking for might have been moved, deleted, or never existed in the production timeline.
            </p>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <AppButton
              variant="default"
              size="lg"
              onClick={() => router.push("/dashboard")}
              className="font-semibold shadow-md shadow-primary/20"
            >
              Back to Dashboard
            </AppButton>
            <AppButton
              variant="outline"
              size="lg"
              onClick={() => router.back()}
              className="font-semibold"
            >
              Go Back
            </AppButton>
          </div>

          {/* Helpful Navigation Links Card */}
          <div className="w-full max-w-md pt-6">
            <div className="p-4 rounded-2xl bg-card/60 border border-border/70 backdrop-blur-sm shadow-xs space-y-2.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-left pl-1">
                Helpful destinations
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Link
                  href="/dashboard"
                  className="flex items-center gap-2 p-2.5 rounded-xl bg-background/60 hover:bg-accent border border-border/50 text-xs font-medium text-foreground transition-all text-left"
                >
                  <span className="text-primary font-bold">✨</span>
                  <span>Clip Generator</span>
                </Link>
                <Link
                  href="/my-clips"
                  className="flex items-center gap-2 p-2.5 rounded-xl bg-background/60 hover:bg-accent border border-border/50 text-xs font-medium text-foreground transition-all text-left"
                >
                  <span className="text-chart-4 font-bold">🎬</span>
                  <span>My Media Library</span>
                </Link>
                <Link
                  href="/billing"
                  className="flex items-center gap-2 p-2.5 rounded-xl bg-background/60 hover:bg-accent border border-border/50 text-xs font-medium text-foreground transition-all text-left"
                >
                  <span className="text-chart-2 font-bold">⚡</span>
                  <span>Subscription Plan</span>
                </Link>
                <Link
                  href="/login"
                  className="flex items-center gap-2 p-2.5 rounded-xl bg-background/60 hover:bg-accent border border-border/50 text-xs font-medium text-foreground transition-all text-left"
                >
                  <span className="text-muted-foreground font-bold">👤</span>
                  <span>Account Login</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ── Minimal Footer ── */}
      <footer className="relative z-10 w-full py-4 text-center text-xs text-muted-foreground border-t border-border/40">
        <p>© {new Date().getFullYear()} Blynta. AI Video Clip Generator.</p>
      </footer>
    </div>
  );
}
