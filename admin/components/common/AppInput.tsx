"use client";
import { useId, type ComponentProps, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
export function AppInput({ label, prefixIcon, id, className, ...props }: ComponentProps<typeof Input> & { label?: string; prefixIcon?: ReactNode }) {
  const generated = useId(); const inputId = id || generated;
  return <div className="space-y-2">{label && <Label htmlFor={inputId}>{label}</Label>}<div className="relative">{prefixIcon && <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground">{prefixIcon}</span>}<Input id={inputId} className={cn(prefixIcon && "pl-9", className)} {...props} /></div></div>;
}
