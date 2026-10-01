"use client";
import { useTheme } from "next-themes";
import { SunMoon } from "lucide-react";
import { AppButton } from "./AppButton";
export function ThemeToggle() { const { resolvedTheme, setTheme } = useTheme(); return <AppButton variant="ghost" size="icon" aria-label="Toggle color theme" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}><SunMoon className="size-4" /></AppButton>; }
