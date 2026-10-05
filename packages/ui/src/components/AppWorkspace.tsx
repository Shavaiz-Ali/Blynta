"use client";

import type { ComponentProps, ReactNode, ReactElement } from "react";
import { cn } from "../lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "../primitives/tooltip";

export function AppHeader({ className, ...props }: ComponentProps<"header">) {
  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-14 items-center gap-2 px-4 sm:px-5 bg-background/90 backdrop-blur-sm border-b border-border/70 shrink-0",
        className,
      )}
      {...props}
    />
  );
}

export function AppSidebar({
  collapsed = false,
  className,
  ...props
}: ComponentProps<"aside"> & { collapsed?: boolean }) {
  return (
    <aside
      className={cn(
        "hidden md:flex shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground h-screen transition-all duration-300 ease-in-out",
        collapsed ? "w-[60px]" : "w-[220px] lg:w-[240px]",
        className,
      )}
      {...props}
    />
  );
}

export function AppSidebarItem({
  label,
  icon,
  active = false,
  collapsed = false,
  disabled = false,
  badge,
  href,
  onClick,
  renderLink,
  rail = false,
  className,
  ...accessibility
}: {
  label: string;
  icon: ReactNode;
  active?: boolean;
  collapsed?: boolean;
  disabled?: boolean;
  badge?: ReactNode;
  href?: string;
  onClick?: () => void;
  rail?: boolean;
  className?: string;
  id?: string;
  "aria-label"?: string;
  "aria-controls"?: string;
  "aria-expanded"?: boolean;
  "aria-pressed"?: boolean;
  renderLink?: (props: {
    className: string;
    children: ReactNode;
    onClick?: () => void;
    title?: string;
    "aria-current"?: "page";
  }) => ReactElement;
}) {
  const classes = cn(
    "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium transition-all w-full",
    collapsed && "justify-center px-2",
    rail && "flex-col justify-center gap-1.5 px-1 py-2 text-[10px] min-h-14",
    disabled
      ? "opacity-40 cursor-not-allowed text-muted-foreground"
      : active
        ? "bg-primary text-primary-foreground font-semibold shadow-xs"
        : "text-muted-foreground hover:bg-sidebar-accent! dark:hover:text-foreground hover:text-sidebar-accent-foreground! cursor-pointer",
    className,
  );
  const children = (
    <>
      <span className="flex shrink-0 items-center [&>svg]:h-4 [&>svg]:w-4">
        {icon}
      </span>
      {(!collapsed || rail) && (
        <>
          <span className={cn("truncate", !rail && "flex-1 text-left")}>
            {label}
          </span>
          {badge}
        </>
      )}
    </>
  );
  const props = {
    ...accessibility,
    className: classes,
    children,
    onClick,
    title: collapsed ? label : undefined,
    "aria-current": active && href ? ("page" as const) : undefined,
  };
  const element =
    href && !disabled ? (
      renderLink ? (
        renderLink(props)
      ) : (
        <a href={href} {...props} />
      )
    ) : (
      <button
        type="button"
        disabled={disabled}
        aria-label={label}
        aria-pressed={active}
        {...props}
      />
    );
  return collapsed && !rail ? (
    <Tooltip>
      <TooltipTrigger render={element} />
      <TooltipContent side="right" className="text-xs">
        {label}
      </TooltipContent>
    </Tooltip>
  ) : (
    element
  );
}
