"use client";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { AppButton } from "./AppButton";
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <AppButton
      variant="ghost"
      size="icon"
      aria-label="Switch theme"
      title="Switch light / dark theme"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <Sun className="dark:hidden" />
      <Moon className="hidden dark:block" />
    </AppButton>
  );
}
