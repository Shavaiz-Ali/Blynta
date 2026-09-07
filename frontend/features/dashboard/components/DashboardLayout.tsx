"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BlyntaLogo } from "@/components/logo";
import { AppButton } from "@/components/common/AppButton";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

import { useCurrentUser } from "@/features/auth/queries";
import { InviteMembersDialog } from "./InviteMembersDialog";
import {
  UserPlusIcon,
  FilmIcon,
  ClockIcon,
  CreditCardIcon,
  SettingsIcon,
  FolderIcon,
  Share2Icon,
  ChevronRightIcon,
  ZapIcon,
} from "../icons";

/* -------------------------------------------------------------------------- */
/*                                 Icon set                                   */
/* -------------------------------------------------------------------------- */

const Icon = {
  LayoutDashboard: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect width="7" height="9" x="3" y="3" rx="1" />
      <rect width="7" height="5" x="14" y="3" rx="1" />
      <rect width="7" height="9" x="14" y="12" rx="1" />
      <rect width="7" height="5" x="3" y="16" rx="1" />
    </svg>
  ),
  Menu: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <line x1="4" x2="20" y1="12" y2="12" />
      <line x1="4" x2="20" y1="6" y2="6" />
      <line x1="4" x2="20" y1="18" y2="18" />
    </svg>
  ),
  PanelLeft: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M9 3v18" />
    </svg>
  ),
};

/* -------------------------------------------------------------------------- */
/*                           Navigation Schema                                */
/* -------------------------------------------------------------------------- */

export interface NavGroup {
  title: string;
  items: {
    label: string;
    href: string;
    icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    badge?: string;
    disabled?: boolean;
  }[];
}

export const navGroups: NavGroup[] = [
  {
    title: "Workspace",
    items: [
      { label: "Home", href: "/dashboard", icon: Icon.LayoutDashboard },
      { label: "My Clips", href: "/my-clips", icon: FilmIcon },
      { label: "Projects", href: "/jobs", icon: FolderIcon },
    ],
  },
  {
    title: "Publish",
    items: [
      { label: "Calendar", href: "/jobs", icon: ClockIcon },
      {
        label: "Social Accounts",
        href: "#",
        icon: Share2Icon,
        badge: "Soon",
        disabled: true,
      },
    ],
  },
  {
    title: "Account",
    items: [
      { label: "Billing", href: "/billing", icon: CreditCardIcon },
      { label: "Settings", href: "/settings", icon: SettingsIcon },
    ],
  },
];

function findActiveNavItem(pathname: string) {
  for (const group of navGroups) {
    for (const item of group.items) {
      if (item.href === pathname) return item;
    }
  }
  return navGroups[0].items[0];
}

/* -------------------------------------------------------------------------- */
/*                           Nav Item                                         */
/* -------------------------------------------------------------------------- */

function NavItem({
  item,
  isActive,
  isCollapsed,
  onNavigate,
}: {
  item: NavGroup["items"][number];
  isActive: boolean;
  isCollapsed: boolean;
  onNavigate?: () => void;
}) {
  const Comp = item.icon;

  const inner = (
    <>
      <Comp
        className={cn(
          "h-4 w-4 shrink-0 transition-colors",
          isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
        )}
      />
      {!isCollapsed && (
        <>
          <span className="truncate flex-1">{item.label}</span>
          {item.badge && (
            <Badge
              variant={isActive ? "outline" : "secondary"}
              className={cn(
                "text-[10px] h-4 px-1.5 font-bold uppercase tracking-wider ml-auto",
                isActive
                  ? "bg-primary-foreground/20 text-primary-foreground border-transparent"
                  : "bg-muted text-muted-foreground",
                item.disabled && "opacity-60"
              )}
            >
              {item.badge}
            </Badge>
          )}
        </>
      )}
    </>
  );

  const baseCls = cn(
    "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium transition-all w-full",
    isCollapsed && "justify-center px-2",
    item.disabled
      ? "opacity-40 cursor-not-allowed text-muted-foreground"
      : isActive
        ? "bg-primary text-primary-foreground font-semibold shadow-xs"
        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground cursor-pointer"
  );

  const element = item.disabled ? (
    <button
      key={item.label}
      type="button"
      disabled
      title={isCollapsed ? `${item.label} — Coming soon` : "Coming soon"}
      className={baseCls}
    >
      {inner}
    </button>
  ) : (
    <Link
      key={item.label}
      href={item.href}
      onClick={onNavigate}
      title={isCollapsed ? item.label : undefined}
      className={baseCls}
    >
      {inner}
    </Link>
  );

  if (isCollapsed) {
    return (
      <Tooltip>
        <TooltipTrigger render={element} />
        <TooltipContent side="right" className="text-xs">
          {item.label}
          {item.badge && ` — ${item.badge}`}
        </TooltipContent>
      </Tooltip>
    );
  }

  return element;
}

/* -------------------------------------------------------------------------- */
/*                           Sidebar Content                                  */
/* -------------------------------------------------------------------------- */

function SidebarContent({
  isCollapsed,
  onOpenInvite,
  onNavigate,
}: {
  isCollapsed: boolean;
  onOpenInvite: () => void;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { data: profile } = useCurrentUser();

  const initials = (profile?.name || profile?.email || "U")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex h-full flex-col gap-2 overflow-y-auto overflow-x-hidden">
      {/* ── Logo & Workspace Lockup ── */}
      <div
        className={cn(
          "flex items-center shrink-0 px-3.5 pt-3.5 pb-1",
          isCollapsed ? "justify-center" : "justify-between"
        )}
      >
        <Link href="/dashboard" onClick={onNavigate} className="flex items-center gap-2.5 min-w-0">
          <BlyntaLogo variant={isCollapsed ? "icon" : "full"} size="md" />
        </Link>
      </div>

      {/* ── Quick Create Action Pill ── */}
      <div className={cn("shrink-0 px-2.5 pt-1 pb-1")}>
        {isCollapsed ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <Link
                  href="/dashboard"
                  onClick={onNavigate}
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs transition-colors mx-auto"
                >
                  <ZapIcon className="h-4 w-4" />
                </Link>
              }
            />
            <TooltipContent side="right" className="text-xs">
              Quick Create
            </TooltipContent>
          </Tooltip>
        ) : (
          <Link
            href="/dashboard"
            onClick={onNavigate}
            className="flex items-center gap-2 w-full h-9 px-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold shadow-xs transition-all"
          >
            <ZapIcon className="h-4 w-4 shrink-0" />
            <span>Quick Create</span>
          </Link>
        )}
      </div>

      <div className="px-2.5 py-0.5">
        <Separator className="bg-border/50" />
      </div>

      {/* ── Grouped Navigation ── */}
      <nav className="flex-1 flex flex-col gap-3 px-2.5">
        {navGroups.map((group) => (
          <div key={group.title} className="flex flex-col gap-1">
            {!isCollapsed && (
              <p className="px-3 pt-2 pb-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
                {group.title}
              </p>
            )}
            {group.items.map((item) => {
              const isActive = !item.disabled && pathname === item.href;
              return (
                <NavItem
                  key={item.label}
                  item={item}
                  isActive={isActive}
                  isCollapsed={isCollapsed}
                  onNavigate={onNavigate}
                />
              );
            })}
          </div>
        ))}
      </nav>

      {/* ── Sidebar Footer: Workspace & User Profile ── */}
      <div className={cn("shrink-0 mt-auto border-t border-border/60", isCollapsed ? "p-2" : "p-3 space-y-2.5")}>
        {!isCollapsed ? (
          <>
            <div className="flex items-center gap-2.5 px-0.5">
              <Avatar className="h-8 w-8 rounded-lg shrink-0 border border-border/80 bg-muted">
                <AvatarFallback className="rounded-lg bg-primary/15 text-primary text-xs font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-foreground truncate leading-tight">
                  {profile?.name || "Workspace"}
                </p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {profile?.email || "Personal workspace"}
                </p>
              </div>
            </div>

            <AppButton
              variant="outline"
              size="sm"
              onClick={onOpenInvite}
              className="w-full justify-center h-8 text-xs font-medium cursor-pointer shadow-2xs border-border/70 hover:bg-muted/60"
              icon={<UserPlusIcon className="h-3.5 w-3.5 text-primary" />}
            >
              Invite members
            </AppButton>
          </>
        ) : (
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  onClick={onOpenInvite}
                  className="flex justify-center w-full py-1 hover:opacity-80 transition-opacity cursor-pointer"
                />
              }
            >
              <Avatar className="h-8 w-8 rounded-lg border border-border/80 bg-muted">
                <AvatarFallback className="rounded-lg bg-primary/15 text-primary text-xs font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">
              {profile?.name || "Workspace"}
              <br />
              <span className="text-muted-foreground">+ Invite members</span>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                         Exported DashboardLayout                           */
/* -------------------------------------------------------------------------- */

export interface DashboardLayoutProps {
  children: React.ReactNode;
  headerContent?: React.ReactNode;
}

export function DashboardLayout({ children, headerContent }: DashboardLayoutProps) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [inviteOpen, setInviteOpen] = React.useState(false);

  return (
    <div className="h-screen flex bg-background text-foreground overflow-hidden">
      {/* ── Desktop Collapsible Sidebar ── */}
      <aside
        className={cn(
          "hidden md:flex shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground h-screen transition-all duration-300 ease-in-out",
          isCollapsed ? "w-[60px]" : "w-[220px] lg:w-[240px]"
        )}
      >
        <SidebarContent
          isCollapsed={isCollapsed}
          onOpenInvite={() => setInviteOpen(true)}
        />
      </aside>

      {/* ── Mobile Drawer (shadcn Sheet) ── */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[240px] p-0 bg-sidebar text-sidebar-foreground">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarContent
            isCollapsed={false}
            onOpenInvite={() => {
              setMobileOpen(false);
              setInviteOpen(true);
            }}
            onNavigate={() => setMobileOpen(false)}
          />
        </SheetContent>
      </Sheet>

      {/* ── Main Content Viewport ── */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 px-4 sm:px-5 bg-background/90 backdrop-blur-sm border-b border-border/70 shrink-0">
          {/* Mobile hamburger */}
          <AppButton
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen(true)}
            className="md:hidden h-8 w-8 rounded-lg -ml-1"
            aria-label="Open menu"
          >
            <Icon.Menu className="h-4.5 w-4.5" />
          </AppButton>

          {/* Desktop collapse toggle */}
          <div className="hidden md:flex items-center gap-2 shrink-0">
            <AppButton
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setIsCollapsed((prev) => !prev)}
              className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
              title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <Icon.PanelLeft className="h-4.5 w-4.5" />
            </AppButton>
            <div className="h-5 w-px bg-border/80 shrink-0" />
          </div>

          {/* Header content */}
          <div className="flex-1 min-w-0 flex items-center">
            {headerContent}
          </div>
        </header>

        <main className="flex-1 min-w-0">{children}</main>
      </div>

      {/* Invite Members Modal */}
      <InviteMembersDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </div>
  );
}

export { Icon };
