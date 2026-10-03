"use client";
import type { ComponentProps } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
export function AppScrollArea({
  className,
  ...props
}: ComponentProps<typeof ScrollArea>) {
  return <ScrollArea className={cn("min-h-0 min-w-0", className)} {...props} />;
}
