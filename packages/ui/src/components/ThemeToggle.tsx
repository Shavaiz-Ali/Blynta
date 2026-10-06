"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { SunIcon, MoonIcon } from "lucide-react";
import { cn } from "../lib/utils";

const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = React.useSyncExternalStore(
    subscribe,
    clientSnapshot,
    serverSnapshot,
  );

  if (!mounted) {
    return (
      <div
        className={cn(
          "h-9 w-9 rounded-xl bg-muted/60 border border-border/70 animate-pulse",
          className,
        )}
      />
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn(
        "relative inline-flex h-9 w-9 items-center justify-center rounded-xl bg-muted/60 border border-border/70 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer",
        className,
      )}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
    >
      {isDark ? (
        <SunIcon className="h-4 w-4 text-foreground" />
      ) : (
        <MoonIcon className="h-4 w-4 text-foreground" />
      )}
    </button>
  );
}
