import * as React from "react";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { BlyntaLogo } from "@/components/logo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen flex flex-col justify-between bg-background text-foreground overflow-hidden">
      {/* Ambient background glow & grid */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div
          className="absolute -top-[20%] left-1/2 -translate-x-1/2 w-[800px] h-[500px] opacity-25 dark:opacity-20 pointer-events-none"
          style={{
            background:
              "radial-gradient(circle at 50% 30%, var(--primary) 0%, transparent 70%)",
            filter: "blur(90px)",
          }}
        />
        <svg
          className="absolute inset-0 w-full h-full opacity-[0.03] dark:opacity-[0.05] text-foreground pointer-events-none"
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
      </div>

      {/* Header */}
      <header className="relative z-10 p-4 sm:p-6 flex justify-between items-center max-w-6xl mx-auto w-full">
        <div className="flex items-center gap-2.5">
          <BlyntaLogo size="sm" />
          <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-primary border border-primary/20">
            Admin
          </span>
        </div>
        <ThemeToggle />
      </header>

      {/* Main Form Area */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6">
        {children}
      </main>

      {/* Footer */}
      <footer className="relative z-10 p-4 sm:p-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Blynta. Internal administration only.
      </footer>
    </div>
  );
}
