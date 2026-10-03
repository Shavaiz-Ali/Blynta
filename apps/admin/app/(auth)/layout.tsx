import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { BlyntaLogo } from "@/components/logo";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen min-w-0 flex-col overflow-x-hidden bg-background text-foreground">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between border-b px-4 py-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <BlyntaLogo size="sm" />
          <span className="rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
            Admin
          </span>
        </div>
        <ThemeToggle />
      </header>

      <main className="flex min-w-0 flex-1 items-center justify-center p-4 sm:p-6">
        {children}
      </main>

      <footer className="border-t p-4 text-center text-xs text-muted-foreground sm:p-6">
        © {new Date().getFullYear()} Blynta. Internal administration only.
      </footer>
    </div>
  );
}
