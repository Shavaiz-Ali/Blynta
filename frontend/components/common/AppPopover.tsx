"use client";

import * as React from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface AppPopoverProps {
  /** The element that toggles the popover open/closed. */
  trigger: React.ReactElement;
  /** Popover body. */
  children: React.ReactNode;
  /** Horizontal alignment relative to the trigger. @default "end" */
  align?: "start" | "center" | "end";
  /** Which side of the trigger to render on. @default "bottom" */
  side?: "top" | "bottom" | "left" | "right";
  /** Pixel offset from the trigger edge. @default 6 */
  sideOffset?: number;
  /** Extra classes on the popover panel. */
  contentClassName?: string;
  /** Controlled open state. */
  open?: boolean;
  /** Called when open state changes. */
  onOpenChange?: (open: boolean) => void;
}

/**
 * Blynta's standard popover.
 *
 * Wraps the shadcn `Popover` primitive to enforce consistent styling,
 * alignment and animation across the application. Feature code should
 * import `AppPopover` rather than the raw shadcn `Popover` components.
 */
export function AppPopover({
  trigger,
  children,
  align = "end",
  side = "bottom",
  sideOffset = 6,
  contentClassName,
  open,
  onOpenChange,
}: AppPopoverProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger render={trigger} />
      <PopoverContent
        align={align}
        side={side}
        sideOffset={sideOffset}
        className={cn(
          "w-auto rounded-xl bg-card border border-border/80 p-0 gap-0 shadow-2xl z-50 overflow-hidden text-card-foreground",
          contentClassName
        )}
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}
