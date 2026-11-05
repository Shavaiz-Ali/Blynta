import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { BlyntaLogo } from "@/components/logo";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen min-w-0 flex-col overflow-x-hidden bg-background text-foreground">
      {/* Ambient background glow */}
      <div
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[350px] opacity-25 dark:opacity-20 blur-3xl rounded-full"
        style={{
          background: "radial-gradient(circle, var(--primary) 0%, var(--chart-3) 50%, transparent 80%)",
        }}
      />

      {/* Top Header */}
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border/70 bg-background/80 px-4 sm:px-8 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <BlyntaLogo size="sm" badge="Admin" />
        </div>
        <ThemeToggle />
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 flex min-w-0 flex-1 items-center justify-center p-4 sm:p-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/60 py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Blynta Inc. Internal administration only.
      </footer>
    </div>
  );
}
