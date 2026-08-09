"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BlyntaLogo } from "@/components/logo";
import { AppButton } from "@/components/common/AppButton";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

import { useCurrentUser } from "@/features/auth/queries";
import { UpgradeCard } from "./UpgradeCard";
import { InviteMembersDialog } from "./InviteMembersDialog";
import {
  UserPlusIcon,
  FilmIcon,
  ClockIcon,
  CreditCardIcon,
  SettingsIcon,
  FolderIcon,
  Share2Icon,
} from "../icons";

/* -------------------------------------------------------------------------- */
/*                                 Icon set                                   */
/* -------------------------------------------------------------------------- */

const Icon = {
  LayoutDashboard: (p: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect width="7" height="9" x="3" y="3" rx="1" />
      <rect width="7" height="5" x="14" y="3" rx="1" />
      <rect width="7" height="9" x="14" y="12" rx="1" />
      <rect width="7" height="5" x="3" y="16" rx="1" />
    </svg>
  ),
  Menu: (p: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <line x1="4" x2="20" y1="12" y2="12" />
      <line x1="4" x2="20" y1="6" y2="6" />
      <line x1="4" x2="20" y1="18" y2="18" />
    </svg>
  ),
  X: (p: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  ),
  PanelToggle: (p: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M9 3v18" />
    </svg>
  ),
};

/* -------------------------------------------------------------------------- */
/*                           Grouped Navigation Schema                        */
/* -------------------------------------------------------------------------- */

export interface NavGroup {
  title: string;
  items: {
    label: string;
    href: string;
    icon: React.ComponentType<any>;
    badge?: string;
  }[];
}

export const navGroups: NavGroup[] = [
  {
    title: "Create",
    items: [
      { label: "Home", href: "/dashboard", icon: Icon.LayoutDashboard },
      { label: "My Clips", href: "/jobs", icon: FilmIcon },
      { label: "Asset library", href: "/jobs", icon: FolderIcon },
    ],
  },
  {
    title: "Post",
    items: [
      { label: "Calendar", href: "/jobs", icon: ClockIcon },
      { label: "Social accounts", href: "/settings", icon: Share2Icon },
    ],
  },
  {
    title: "Account",
    items: [
      { label: "Subscription", href: "/billing", icon: CreditCardIcon },
      { label: "Settings", href: "/settings", icon: SettingsIcon },
    ],
  },
];

/* -------------------------------------------------------------------------- */
/*                           Helper: find active nav item                     */
/* -------------------------------------------------------------------------- */

function findActiveNavItem(pathname: string) {
  for (const group of navGroups) {
    for (const item of group.items) {
      if (item.href === pathname) return item;
    }
  }
  return navGroups[0].items[0];
}

/* -------------------------------------------------------------------------- */
/*                           Layout Props & Interface                         */
/* -------------------------------------------------------------------------- */

export interface DashboardLayoutProps {
  children: React.ReactNode;
  headerContent?: React.ReactNode;
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

  const planLabel = profile?.plan === "free" ? "Free" : "Pro";

  return (
    <div className="flex h-full flex-col p-3.5 sm:p-4 gap-4 overflow-y-auto overflow-x-hidden">
      {/* ── Sidebar Top Header: Logo + Plan Badge ── */}
      <div
        className={cn(
          "flex items-center gap-2 shrink-0 px-1 pt-1",
          isCollapsed ? "justify-center" : "justify-start"
        )}
      >
        <Link href="/dashboard" onClick={onNavigate} className="flex items-center gap-2 min-w-0">
          <BlyntaLogo variant={isCollapsed ? "icon" : "full"} size="md" />
          {!isCollapsed && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-muted text-muted-foreground border border-border/80">
              {planLabel}
            </span>
          )}
        </Link>
      </div>

      {/* ── Workspace / User Account Selector & Invite Members Button ── */}
      {!isCollapsed ? (
        <div className="flex flex-col gap-2 shrink-0 p-2.5 rounded-xl bg-sidebar-accent/50 border border-sidebar-border/80">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-chart-4 text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0 shadow-xs">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-sidebar-foreground truncate leading-tight">
                {profile?.name || profile?.email || "My Workspace"}
              </p>
              <div className="flex items-center gap-1 text-[10px] text-sidebar-foreground/60 mt-0.5">
                <span>👤</span>
                <span>0 members</span>
              </div>
            </div>
          </div>

          <AppButton
            variant="outline"
            size="sm"
            onClick={() => {
              onOpenInvite();
              onNavigate?.();
            }}
            icon={<UserPlusIcon className="h-3.5 w-3.5" />}
            className="w-full h-8 text-xs font-semibold justify-center bg-card/60 border-sidebar-border/80 hover:bg-sidebar-accent"
          >
            Invite members
          </AppButton>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 shrink-0 py-1">
          <div
            className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-chart-4 text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0 shadow-xs"
            title={profile?.name || profile?.email || "My Workspace"}
          >
            {initials}
          </div>
          <button
            type="button"
            onClick={onOpenInvite}
            className="p-2 rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors cursor-pointer"
            title="Invite members"
          >
            <UserPlusIcon className="h-4 w-4" />
          </button>
        </div>
      )}

      <Separator />

      {/* ── Grouped Nav Sections ── */}
      <nav className="flex-1 flex flex-col gap-3">
        {navGroups.map((group) => (
          <div key={group.title} className="flex flex-col gap-2">
            {!isCollapsed && (
              <p className="px-2 text-[10px] font-bold uppercase tracking-wider text-sidebar-foreground/50 mb-1">
                {group.title}
              </p>
            )}
            {group.items.map((item) => {
              const isActive = pathname === item.href;
              const Comp = item.icon;
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={onNavigate}
                  title={isCollapsed ? item.label : undefined}
                  className={cn(
                    "group flex items-center gap-3 rounded-md py-2 text-xs font-medium transition-all",
                    isCollapsed ? "justify-center px-2" : "px-3",
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold shadow-xs"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  <Comp className="h-4.5 w-4.5 shrink-0" />
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                  {!isCollapsed && item.badge && (
                    <span className="ml-auto inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-primary/15 text-primary">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* ── Footer Upgrade Card ── */}
      {/* {!isCollapsed && (
        <div className="mt-auto pt-2 shrink-0">
          <UpgradeCard plan={profile?.plan ?? "free"} />
        </div>
      )} */}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                          Mobile Drawer Overlay                             */
/* -------------------------------------------------------------------------- */

function MobileDrawer({
  open,
  onOpenChange,
  onOpenInvite,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenInvite: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      <aside className="absolute left-0 top-0 h-full w-72 max-w-[85vw] bg-sidebar text-sidebar-foreground shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-sidebar-border">
          <BlyntaLogo size="sm" />
          <button
            onClick={() => onOpenChange(false)}
            className="p-2 rounded-lg hover:bg-sidebar-accent transition-colors"
            aria-label="Close menu"
          >
            <Icon.X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <SidebarContent
            isCollapsed={false}
            onOpenInvite={onOpenInvite}
            onNavigate={() => onOpenChange(false)}
          />
        </div>
      </aside>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                         Exported DashboardLayout                           */
/* -------------------------------------------------------------------------- */

export function DashboardLayout({ children, headerContent }: DashboardLayoutProps) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const pathname = usePathname();

  const activeItem = findActiveNavItem(pathname);

  return (
    <div className="h-screen flex bg-background text-foreground overflow-hidden">
      {/* Desktop Collapsible Sidebar */}
      <aside
        className={cn(
          "hidden md:flex shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground h-screen transition-all duration-300 ease-in-out",
          isCollapsed ? "w-[72px]" : "w-64 lg:w-72"
        )}
      >
        <SidebarContent
          isCollapsed={isCollapsed}
          onOpenInvite={() => setInviteOpen(true)}
        />
      </aside>

      {/* Mobile Drawer */}
      <MobileDrawer
        open={mobileOpen}
        onOpenChange={setMobileOpen}
        onOpenInvite={() => setInviteOpen(true)}
      />

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 bg-background/80 backdrop-blur border-b border-border shrink-0">
          {/* Mobile menu button */}
          <button
            onClick={() => setMobileOpen(true)}
            className="md:hidden p-2 -ml-2 rounded-lg hover:bg-accent transition-colors"
            aria-label="Open menu"
          >
            <Icon.Menu className="h-5 w-5" />
          </button>

          {/* Desktop: Sidebar collapse + current page indicator */}
          <div className="hidden md:flex items-center gap-2 min-w-0">
            {/* Collapse toggle button */}
            <button
              type="button"
              onClick={() => setIsCollapsed((prev) => !prev)}
              className="inline-flex items-center justify-center h-9 w-9 rounded-lg bg-transparent hover:bg-accent text-muted-foreground hover:text-foreground transition-colors cursor-pointer shrink-0"
              title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <Icon.PanelToggle className="h-5 w-5" />
            </button>

            {/* Vertical separator */}
            <div className="h-6 w-px bg-border shrink-0" />

            {/* Current page title */}
            <div className="flex items-center gap-2 min-w-0">
              <h2 className="text-base sm:text-lg font-semibold tracking-tight text-foreground truncate">
                {activeItem.label}
              </h2>
            </div>
          </div>

          {/* Right-side header content */}
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
