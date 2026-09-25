"use client";

import * as React from "react";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  tabsListVariants,
  tabsTriggerVariants,
} from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export interface AppTabItem {
  value: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  disabled?: boolean;
  content?: React.ReactNode;
}

export type AppTabsVariant = "default" | "primary" | "line" | "pills";
export type AppTabsSize = "xs" | "sm" | "default" | "lg";

export interface AppTabsProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  orientation?: "horizontal" | "vertical";
  variant?: AppTabsVariant;
  size?: AppTabsSize;
  tabs?: AppTabItem[];
  className?: string;
  listClassName?: string;
  triggerClassName?: string;
  contentClassName?: string;
  children?: React.ReactNode;
}

export function AppTabs({
  value,
  defaultValue,
  onValueChange,
  orientation = "horizontal",
  variant = "default",
  size = "default",
  tabs,
  className,
  listClassName,
  triggerClassName,
  contentClassName,
  children,
}: AppTabsProps) {
  const handleValueChange = (val: unknown) => {
    if (onValueChange && val !== undefined && val !== null) {
      onValueChange(String(val));
    }
  };

  return (
    <Tabs
      value={value}
      defaultValue={defaultValue}
      onValueChange={handleValueChange}
      orientation={orientation}
      className={cn("w-auto", className)}
    >
      {tabs && tabs.length > 0 && (
        <TabsList variant={variant} size={size} className={listClassName}>
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              disabled={tab.disabled}
              variant={variant}
              size={size}
              className={triggerClassName}
            >
              {tab.icon && <span className="shrink-0">{tab.icon}</span>}
              <span>{tab.label}</span>
              {tab.badge && <span className="shrink-0">{tab.badge}</span>}
            </TabsTrigger>
          ))}
        </TabsList>
      )}

      {/* Render tab panel contents if supplied in the tabs definition */}
      {tabs?.map((tab) =>
        tab.content ? (
          <TabsContent
            key={tab.value}
            value={tab.value}
            className={contentClassName}
          >
            {tab.content}
          </TabsContent>
        ) : null
      )}

      {/* Custom children (e.g. compound sub-components or custom panels) */}
      {children}
    </Tabs>
  );
}

// Re-export underlying primitive sub-components for compound composition
export const AppTabsList = TabsList;
export const AppTabsTrigger = TabsTrigger;
export const AppTabsContent = TabsContent;
export { tabsListVariants, tabsTriggerVariants };
