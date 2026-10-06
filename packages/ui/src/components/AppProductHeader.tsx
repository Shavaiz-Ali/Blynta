"use client";

import { useState, type ReactElement, type ReactNode } from "react";
import { Menu, PanelLeft, Zap, Bell, Sun, Check } from "lucide-react";
import { useTheme } from "next-themes";
import { AppHeader } from "./AppWorkspace";
import { AppButton } from "./AppButton";
import { AppPopover } from "./AppPopover";
import { AppIdentityAvatar } from "./AppIdentityAvatar";
import { Badge } from "../primitives/badge";
import { Progress } from "../primitives/progress";
import { Separator } from "../primitives/separator";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "../primitives/dropdown-menu";
import { cn } from "../lib/utils";

/** Shared product chrome. Product routes, data loading and auth stay in the apps. */
export function AppProductHeader({
  collapsed,
  onCollapse,
  onMenu,
  sidebarId,
  children,
}: {
  collapsed: boolean;
  onCollapse: () => void;
  onMenu: () => void;
  sidebarId?: string;
  children: ReactNode;
}) {
  return (
    <AppHeader>
      <AppButton
        type="button"
        variant="ghost"
        size="icon"
        onClick={onMenu}
        className="md:hidden h-8 w-8 rounded-lg -ml-1"
        aria-label="Open menu"
      >
        <Menu className="h-4.5 w-4.5" />
      </AppButton>
      <div className="hidden md:flex items-center gap-2 shrink-0">
        <AppButton
          type="button"
          variant="ghost"
          size="icon"
          onClick={onCollapse}
          className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          aria-controls={sidebarId}
        >
          <PanelLeft className="h-4.5 w-4.5" />
        </AppButton>
        <div className="h-5 w-px bg-border/80 shrink-0" />
      </div>
      <div className="flex-1 min-w-0 flex items-center">{children}</div>
    </AppHeader>
  );
}

export function AppHeaderActions({
  credits,
  notifications,
  account,
}: {
  credits: ReactNode;
  notifications: ReactNode;
  account: ReactNode;
}) {
  return (
    <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
      {credits}
      {notifications}
      {account}
    </div>
  );
}

export function AppCreditsControl({
  balance,
  plan,
  allowance,
  resetAt,
  error,
  billingLink,
  usageLink,
}: {
  balance?: number;
  plan?: string;
  allowance?: number;
  resetAt?: string;
  error?: string;
  billingLink?: ReactElement;
  usageLink?: ReactElement;
}) {
  const paid = plan === "pro" || plan === "business";
  const remaining =
    balance !== undefined && allowance
      ? Math.max(0, Math.min(100, (balance / allowance) * 100))
      : undefined;
  return (
    <AppPopover
      contentClassName="w-64 p-4 rounded-xl"
      trigger={
        <button
          type="button"
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-card border border-border/80 hover:border-primary/40 text-xs font-semibold text-foreground transition-colors shadow-xs cursor-pointer"
          title="View credit balance"
          aria-label="View credit balance"
        >
          <Zap className="h-3.5 w-3.5 text-primary fill-primary shrink-0" />
          <span className="tabular-nums font-bold">{balance ?? "—"}</span>
          <span className="text-[11px] text-muted-foreground hidden sm:inline font-normal">
            credits
          </span>
        </button>
      }
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Credit Balance</p>
          {plan && (
            <Badge
              variant="secondary"
              className="text-[10px] h-5 px-1.5 font-bold uppercase tracking-wider"
            >
              {plan}
            </Badge>
          )}
        </div>
        {error ? (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        ) : balance === undefined ? (
          <p className="text-xs text-muted-foreground">
            Loading account credits…
          </p>
        ) : (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Remaining</span>
              <span className="font-bold tabular-nums">
                {balance}
                {allowance !== undefined && ` / ${allowance}`}
              </span>
            </div>
            {remaining !== undefined && (
              <>
                <Progress value={remaining} className="h-1.5" />
                <p className="text-[11px] text-muted-foreground">
                  {Math.round(100 - remaining)}% used this period
                </p>
              </>
            )}
            {resetAt && (
              <p className="text-[11px] text-muted-foreground">
                Account reset: {new Date(resetAt).toLocaleDateString()}
              </p>
            )}
          </div>
        )}
        {usageLink && (
          <AppButton
            size="sm"
            variant="ghost"
            nativeButton={false}
            render={usageLink}
            className="w-full"
          >
            View credits / usage
          </AppButton>
        )}
        {billingLink && (
          <>
            <Separator />
            <AppButton
              size="sm"
              nativeButton={false}
              render={billingLink}
              className="w-full"
            >
              <Zap className="h-3 w-3 fill-current" />
              {paid ? "Manage Plan" : "Upgrade for more"}
            </AppButton>
          </>
        )}
      </div>
    </AppPopover>
  );
}

export interface AppAccountIdentity {
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  plan?: string | null;
}
export interface AppAccountLink {
  label: string;
  render: ReactElement;
}
export function AppAccountMenu({
  profile,
  links,
  onSignOut,
}: {
  profile: AppAccountIdentity;
  links: AppAccountLink[];
  onSignOut: () => void;
}) {
  const paid = profile.plan === "pro" || profile.plan === "business";
  const { theme, setTheme } = useTheme();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex items-center gap-2.5 rounded-lg p-1 pr-2 hover:bg-muted/60 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/40 cursor-pointer"
        aria-label="User menu"
      >
        <div className="hidden sm:flex flex-col items-end leading-tight text-right min-w-0">
          <span className="max-w-40 truncate text-xs font-semibold text-foreground">
            {profile.name || profile.email || "Your account"}
          </span>
          {profile.plan && (
            <span className="text-[11px] capitalize text-muted-foreground">
              {profile.plan} plan
            </span>
          )}
        </div>
        <AppIdentityAvatar
          name={profile.name || profile.email || "User"}
          src={profile.avatarUrl}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className="w-56 rounded-xl p-1.5"
      >
        <div className="px-2.5 py-2">
          <p className="text-xs font-semibold text-foreground truncate">
            {profile.name || "User Account"}
          </p>
          <p className="text-[11px] text-muted-foreground truncate mt-0.5">
            {profile.email}
          </p>
          {profile.plan && (
            <Badge
              variant="secondary"
              className={cn(
                "mt-1.5 text-[10px] h-5 px-1.5 font-bold uppercase tracking-wider",
                paid && "bg-primary/15 text-primary border-primary/25",
              )}
            >
              {profile.plan}
            </Badge>
          )}
        </div>
        <DropdownMenuSeparator />
        {links.map((link) => (
          <DropdownMenuItem
            key={link.label}
            render={link.render}
            className="rounded-lg text-xs cursor-pointer"
          >
            {link.label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="rounded-lg text-xs cursor-pointer">
            <span className="flex items-center gap-2">
              <Sun className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Appearance</span>
            </span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-36 rounded-xl p-1">
            {["light", "dark", "system"].map((value) => (
              <DropdownMenuItem
                key={value}
                className="rounded-lg text-xs cursor-pointer flex items-center justify-between"
                onClick={() => setTheme(value)}
              >
                <span className="capitalize">{value}</span>
                {theme === value && (
                  <Check className="h-3.5 w-3.5 text-primary" />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="rounded-lg text-xs text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
          onClick={onSignOut}
        >
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppNotificationControl({
  unreadCount,
  children,
  open: controlledOpen,
  onOpenChange,
  className,
}: {
  unreadCount?: number;
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}) {
  const [localOpen, setLocalOpen] = useState(false);
  const open = controlledOpen ?? localOpen;
  const count = unreadCount ?? 0;
  return (
    <AppPopover
      open={open}
      onOpenChange={onOpenChange || setLocalOpen}
      contentClassName="shadow-2xl overflow-hidden rounded-xl"
      trigger={
        <AppButton
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "relative h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors",
            open && "bg-muted/70 text-foreground",
            className,
          )}
          aria-label={
            count > 0 ? `Notifications, ${count} unread` : "Notifications"
          }
          title="Notifications"
        >
          <Bell className="h-4 w-4" />
          {count > 0 && (
            <span
              className={cn(
                "absolute -top-0.5 -right-0.5 flex items-center justify-center rounded-full bg-primary font-bold text-primary-foreground tabular-nums shadow-xs animate-in zoom-in-50 duration-200",
                count > 9
                  ? "h-4 min-w-4 px-1 text-[9px]"
                  : "h-3.5 w-3.5 text-[9px]",
              )}
            >
              {count > 99 ? "99+" : count}
            </span>
          )}
        </AppButton>
      }
    >
      {children}
    </AppPopover>
  );
}
