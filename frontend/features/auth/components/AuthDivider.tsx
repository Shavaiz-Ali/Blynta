"use client";

import * as React from "react";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export interface AuthDividerProps {
  text?: string;
  className?: string;
  textClassName?: string;
}

function AuthDivider({
  text = "or continue with",
  className,
  textClassName,
}: AuthDividerProps) {
  return (
    <div className={cn("flex items-center gap-4 w-full", className)}>
      <Separator className="flex-1 bg-border h-[0.5px] w-full" />
      <span
        className={cn(
          "text-xs font-medium uppercase tracking-wider text-muted-foreground shrink-0",
          textClassName
        )}
      >
        {text}
      </span>
      <Separator className="flex-1 bg-border h-[0.5px] w-full" />
    </div>
  );
}

export { AuthDivider };
