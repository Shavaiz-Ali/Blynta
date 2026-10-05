"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { AppAvatar } from "@/components/common/AppAvatar";
import {
  AppButton,
  AppHeader,
  AppSidebar,
  AppSidebarItem,
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@blynta/ui";
import {
  ArrowUpLeft,
  FolderOpen,
  Menu,
  PanelLeft,
  Plus,
  Clapperboard,
} from "lucide-react";
import { StudioLogo } from "@/components/common/StudioLogo";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { UserDropdown } from "@/components/common/UserDropdown";
import { blyntaUrl } from "@/config/env";

export function StudioSidebar({
  onNew,
  onBlynta,
  onNavigate,
  collapsed = false,
}: {
  onNew: () => void;
  onBlynta: () => void;
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  const { data: session } = useSession();
  const navigate = (action: () => void) => {
    onNavigate?.();
    action();
  };
  return (
    <div className="flex h-full flex-col gap-2 overflow-x-hidden overflow-y-auto">
      <Link
        href="/dashboard"
        onClick={onNavigate}
        className="flex h-14 shrink-0 items-center px-3.5 overflow-hidden"
        aria-label="Blynta Studio projects"
      >
        <StudioLogo collapsed={collapsed} />
      </Link>
      <div className="mx-2.5 border-t border-border/50" />
      <div className="px-2.5 pt-2">
        <AppButton
          className="w-full h-8 text-xs"
          size={collapsed ? "icon-sm" : "sm"}
          icon={<Plus />}
          aria-label="New project"
          onClick={() => navigate(onNew)}
        >
          {!collapsed && "New project"}
        </AppButton>
      </div>
      <nav
        aria-label="Studio navigation"
        className="flex flex-1 flex-col gap-3 px-2.5"
      >
        <div className="flex flex-col gap-2">
          {!collapsed && (
            <p className="px-3 pt-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
              Workspace
            </p>
          )}
          <AppSidebarItem
            label="Projects"
            icon={<FolderOpen />}
            active
            collapsed={collapsed}
            href="/dashboard"
            onClick={onNavigate}
            renderLink={(props) => <Link href="/dashboard" {...props} />}
          />
        </div>
        <div className="flex flex-col gap-2">
          {!collapsed && (
            <p className="px-3 pt-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
              Library
            </p>
          )}
          <AppSidebarItem
            label="From Blynta"
            icon={<Clapperboard />}
            collapsed={collapsed}
            onClick={() => navigate(onBlynta)}
          />
        </div>
      </nav>
      <div className="mt-auto border-t border-border/60 p-2.5">
        {!collapsed && (
          <div className="mb-3 flex items-center gap-2.5 rounded-lg bg-muted/30 px-3 py-2.5">
            <AppAvatar name={session?.user.name || "Blynta"} />
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold">
                {session?.user.name || "Your workspace"}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {session?.user.email || "Personal workspace"}
              </p>
            </div>
          </div>
        )}
        <AppSidebarItem
          label="Back to Blynta"
          icon={<ArrowUpLeft />}
          collapsed={collapsed}
          href={blyntaUrl}
        />
      </div>
    </div>
  );
}
export function StudioHeader({
  collapsed,
  onCollapse,
  onMenu,
}: {
  collapsed: boolean;
  onCollapse: () => void;
  onMenu: () => void;
}) {
  return (
    <AppHeader>
      <AppButton
        variant="ghost"
        size="icon-sm"
        className="md:hidden"
        onClick={onMenu}
        aria-label="Open Studio navigation"
      >
        <Menu />
      </AppButton>
      <AppButton
        variant="ghost"
        size="icon-sm"
        className="hidden md:inline-flex"
        onClick={onCollapse}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-expanded={!collapsed}
        aria-controls="studio-sidebar"
      >
        <PanelLeft />
      </AppButton>
      <span className="hidden md:block h-5 w-px bg-border/80" />
      <span className="flex-1 text-xs font-medium text-muted-foreground">
        Studio <span className="mx-2 text-border">/</span>{" "}
        <span className="text-foreground">Projects</span>
      </span>
      <AppButton
        variant="outline"
        size="sm"
        className="hidden sm:inline-flex"
        icon={<ArrowUpLeft />}
        nativeButton={false}
        render={<a href={blyntaUrl} />}
      >
        Blynta
      </AppButton>
      <ThemeToggle />
      <UserDropdown />
    </AppHeader>
  );
}
export function StudioShell({
  children,
  onNew,
  onBlynta,
}: {
  children: ReactNode;
  onNew: () => void;
  onBlynta: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="flex h-dvh overflow-hidden bg-background text-foreground">
      <a href="#studio-content" className="studio-skip-link">
        Skip to projects
      </a>
      <AppSidebar id="studio-sidebar" collapsed={collapsed}>
        <StudioSidebar
          collapsed={collapsed}
          onNew={onNew}
          onBlynta={onBlynta}
        />
      </AppSidebar>
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <StudioHeader
          collapsed={collapsed}
          onCollapse={() => setCollapsed(!collapsed)}
          onMenu={() => setMobileOpen(true)}
        />
        <main
          id="studio-content"
          className="studio-workspace-main"
          tabIndex={-1}
        >
          {children}
        </main>
      </div>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[240px] p-0 bg-sidebar">
          <SheetTitle className="sr-only">Blynta Studio navigation</SheetTitle>
          <SheetDescription className="sr-only">
            Your editing workspace
          </SheetDescription>
          <StudioSidebar
            onNew={onNew}
            onBlynta={onBlynta}
            onNavigate={() => setMobileOpen(false)}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}
