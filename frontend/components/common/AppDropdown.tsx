"use client";

import * as React from "react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface AppDropdownItemConfig {
  key?: string;
  label: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  destructive?: boolean;
  separatorBefore?: boolean;
}

export interface AppDropdownProps {
  trigger: React.ReactNode;
  items?: AppDropdownItemConfig[];
  label?: React.ReactNode;
  align?: "start" | "center" | "end";
  side?: "top" | "bottom" | "left" | "right";
  sideOffset?: number;
  contentClassName?: string;
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function AppDropdown({
  trigger,
  items,
  label,
  align = "end",
  side = "bottom",
  sideOffset = 6,
  contentClassName,
  children,
  open,
  onOpenChange,
}: AppDropdownProps) {
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger render={trigger as any} />

      <DropdownMenuContent
        align={align}
        side={side}
        sideOffset={sideOffset}
        className={cn(
          "w-52 rounded-xl bg-card/95 backdrop-blur-xl border border-border/80 shadow-2xl p-1 z-50 text-xs",
          contentClassName
        )}
      >
        {items ? (
          <>
            <DropdownMenuGroup>
              {label && (
                <div className="px-2 py-1 text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                  {label}
                </div>
              )}

              {items.map((item, idx) => (
                <React.Fragment key={item.key || idx}>
                  {item.separatorBefore && (
                    <DropdownMenuSeparator className="my-1 bg-border/70" />
                  )}
                  <DropdownMenuItem
                    disabled={item.disabled}
                    variant={item.destructive ? "destructive" : "default"}
                    onClick={item.onClick}
                    className={cn(
                      "flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg cursor-pointer text-xs",
                      item.destructive &&
                        "text-destructive focus:bg-destructive/10 focus:text-destructive"
                    )}
                  >
                    {item.icon && (
                      <span
                        className={cn(
                          "shrink-0",
                          item.destructive ? "text-destructive" : "text-primary"
                        )}
                      >
                        {item.icon}
                      </span>
                    )}
                    <div className="min-w-0 flex-1 text-left">
                      <span className="font-medium block leading-tight">
                        {item.label}
                      </span>
                      {item.description && (
                        <span
                          className={cn(
                            "text-[10px] block mt-0.5",
                            item.destructive
                              ? "text-destructive/70"
                              : "text-muted-foreground font-mono"
                          )}
                        >
                          {item.description}
                        </span>
                      )}
                    </div>
                  </DropdownMenuItem>
                </React.Fragment>
              ))}
            </DropdownMenuGroup>
          </>
        ) : (
          children
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export {
  DropdownMenu as AppDropdownRoot,
  DropdownMenuTrigger as AppDropdownTrigger,
  DropdownMenuContent as AppDropdownContent,
  DropdownMenuGroup as AppDropdownGroup,
  DropdownMenuItem as AppDropdownItem,
  DropdownMenuSeparator as AppDropdownSeparator,
  DropdownMenuLabel as AppDropdownLabel,
};
