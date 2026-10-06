"use client";
import type { ReactElement } from "react";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "../primitives/context-menu";
import type { AppDropdownItemConfig } from "./AppDropdown";
export function AppContextMenu({
  children,
  items,
  onOpenChange,
}: {
  children: ReactElement;
  items: AppDropdownItemConfig[];
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <ContextMenu onOpenChange={onOpenChange}>
      <ContextMenuTrigger render={children} />
      <ContextMenuContent className="min-w-44">
        {items.map((item, index) => (
          <span key={item.key ?? index}>
            {item.separatorBefore && <ContextMenuSeparator />}
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
