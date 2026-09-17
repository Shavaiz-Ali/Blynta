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
      {/* ── Ambient Theme Background (matches (auth)/layout visual language) ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Radial gradient glow mesh */}
        <div
          className="absolute inset-0 opacity-40 pointer-events-none"
          style={{
            background: `
              radial-gradient(circle at 25% 20%, var(--primary) 0%, transparent 45%),
              radial-gradient(circle at 75% 45%, var(--chart-4) 0%, transparent 40%),
              radial-gradient(circle at 50% 85%, var(--secondary) 0%, transparent 55%)
            `,
            filter: "blur(70px)",
          }}
        />
        {/* Dotted grid overlay */}
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
        <div className="max-w-2xl mx-auto flex flex-col items-center space-y-7">
          {/* Status Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-medium shadow-sm backdrop-blur-md">
            <span className="flex h-2 w-2 rounded-full bg-destructive animate-pulse" />
            <span className="font-mono text-[11px] font-bold tracking-wider uppercase">
              ERROR 404 &bull; SCENE NOT FOUND
            </span>
          </div>

          {/* Stylized 404 in brand gradient */}
          <h1 className="text-8xl sm:text-9xl font-black tracking-tighter leading-none">
            <span className="bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
              404
            </span>
          </h1>

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
