import type { Metadata } from "next";
import * as React from "react";
import { BlyntaLogo } from "@/components/logo";
import { Sparkles, Video, Zap, TrendingUp } from "lucide-react";

export const metadata: Metadata = {
  title: "Account - Blynta",
  description: "Sign in, create an account, or recover your password.",
};

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    /* Forced dark mode wrapper ensuring auth flow is strictly dark themed split-screen */
    <div className="dark bg-background text-foreground min-h-screen w-full flex flex-col lg:flex-row selection:bg-primary/30">
      
      {/* LEFT / TOP PANEL: Clean Logo Header on Mobile / Full 50% Visual Panel on Desktop */}
      <div className="relative w-full lg:w-1/2 flex flex-col justify-center lg:justify-between p-6 sm:p-8 lg:p-14 overflow-hidden border-b lg:border-b-0 lg:border-r border-border/40 shrink-0">
        
        {/* Background Visual Graphic Layer */}
        <div className="absolute inset-0 z-0 bg-gradient-to-br from-background via-card to-background">
          {/* Optional Video Tag with placeholder source */}
          <video
            autoPlay
            muted
            loop
            playsInline
            className="absolute inset-0 w-full h-full object-cover opacity-20 mix-blend-overlay pointer-events-none"
            poster="/video-poster.jpg"
          >
            <source src="/auth-bg.mp4" type="video/mp4" />
          </video>

          {/* Theme Gradient Glow Mesh */}
          <div
            className="absolute -top-[25%] -left-[25%] w-[150%] h-[150%] opacity-40 pointer-events-none"
            style={{
              background: `
                radial-gradient(circle at 20% 30%, var(--primary) 0%, transparent 45%),
                radial-gradient(circle at 80% 70%, var(--secondary) 0%, transparent 40%),
                radial-gradient(circle at 50% 50%, var(--accent) 0%, transparent 60%)
              `,
              filter: "blur(70px)",
            }}
          />

          {/* Ambient Grid Pattern */}
          <svg
            className="absolute inset-0 w-full h-full opacity-10 text-primary pointer-events-none"
            xmlns="http://www.w3.org/2000/svg"
            width="100%"
            height="100%"
          >
            <defs>
              <pattern
                id="auth-grid-pattern"
                width="32"
                height="32"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 32 0 L 0 0 0 32"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#auth-grid-pattern)" />
          </svg>

          {/* Dark Scrim Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        </div>

        {/* TOP BRANDING: Blynta Logo (Centered on mobile, top-left on desktop) */}
        <div className="relative z-10 flex justify-center lg:justify-start w-full">
          <BlyntaLogo variant="full" size="lg" />
        </div>

        {/* CENTER CONTENT: Marketing Copy & Value Props (HIDDEN ON MOBILE, DESKTOP ONLY) */}
        <div className="relative z-10 my-auto py-6 lg:py-10 max-w-lg hidden lg:block">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-medium mb-4 backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Video Intelligence v2.0</span>
          </div>

          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-foreground leading-[1.18] mb-3">
            Turn long videos into{" "}
            <span className="bg-gradient-to-r from-primary via-emerald-400 to-secondary bg-clip-text text-transparent">
              viral clips
            </span>{" "}
            in minutes.
          </h1>

          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
            Auto-detect highlight moments, generate captions, reframes for 9:16 vertical video, and publish everywhere effortlessly.
          </p>

          {/* Feature Cards (Desktop Only) */}
          <div className="mt-8 grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5 p-3.5 rounded-xl border border-border/60 bg-card/50 backdrop-blur-md">
              <Zap className="w-4 h-4 text-primary" />
              <span className="text-xs font-bold text-foreground">10x Speed</span>
              <span className="text-[11px] text-muted-foreground">Instant clips</span>
            </div>

            <div className="flex flex-col gap-1.5 p-3.5 rounded-xl border border-border/60 bg-card/50 backdrop-blur-md">
              <TrendingUp className="w-4 h-4 text-secondary" />
              <span className="text-xs font-bold text-foreground">Viral Score</span>
              <span className="text-[11px] text-muted-foreground">AI predicted</span>
            </div>

            <div className="flex flex-col gap-1.5 p-3.5 rounded-xl border border-border/60 bg-card/50 backdrop-blur-md">
              <Video className="w-4 h-4 text-primary" />
              <span className="text-xs font-bold text-foreground">Auto-Reframing</span>
              <span className="text-[11px] text-muted-foreground">9:16 layout</span>
            </div>
          </div>
        </div>

        {/* FOOTER METRIC (Desktop only) */}
        <div className="relative z-10 hidden lg:flex items-center gap-3 pt-4 border-t border-border/30 text-xs text-muted-foreground">
          <div className="flex -space-x-2 shrink-0">
            <span className="h-7 w-7 rounded-full ring-2 ring-background bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">JD</span>
            <span className="h-7 w-7 rounded-full ring-2 ring-background bg-secondary/20 flex items-center justify-center text-[10px] font-bold text-secondary">MK</span>
            <span className="h-7 w-7 rounded-full ring-2 ring-background bg-emerald-500/20 flex items-center justify-center text-[10px] font-bold text-emerald-400">SL</span>
          </div>
          <span>Join 10,000+ creators scaling their short-form content.</span>
        </div>
      </div>

      {/* RIGHT PANEL: Form Slot Area */}
      <div className="w-full lg:w-1/2 flex-1 flex flex-col justify-center items-center p-4 sm:p-8 lg:p-16 shrink-0 bg-background">
        <div className="w-full max-w-md mx-auto">
          {children}
        </div>
      </div>

    </div>
  );
}
