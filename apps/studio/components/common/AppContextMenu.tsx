"use client";
import type { ReactElement } from "react";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import type { AppMenuAction } from "./AppDropdownMenu";
export function AppContextMenu({
  children,
  items,
}: {
  children: ReactElement;
  items: AppMenuAction[];
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger render={children} />
      <ContextMenuContent className="min-w-44">
        {items.map((item) => (
          <span key={item.label}>
            {item.separator && <ContextMenuSeparator />}
            <ContextMenuItem
              variant={item.destructive ? "destructive" : "default"}
              disabled={item.disabled}
              onClick={item.onClick}
            >
              {item.icon}
              {item.label}
            </ContextMenuItem>
          </span>
        ))}
      </ContextMenuContent>
    </ContextMenu>
  );
}
