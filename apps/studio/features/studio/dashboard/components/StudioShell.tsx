"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import {
  AppButton,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@blynta/ui";
import {
  ArrowUpLeft,
  FolderOpen,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Clapperboard,
} from "lucide-react";
import { StudioLogo } from "@/components/common/StudioLogo";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { UserDropdown } from "@/components/common/UserDropdown";
import { AppTooltip } from "@/components/common/AppTooltip";
import { blyntaUrl } from "@/config/env";

export function StudioSidebar({
  onNew,
  onBlynta,
  onNavigate,
}: {
  onNew: () => void;
  onBlynta: () => void;
  onNavigate?: () => void;
}) {
  return (
    <div className="studio-sidebar-content">
      <AppTooltip content="New project">
        <AppButton
          className="studio-nav-new"
          onClick={() => {
            onNavigate?.();
            onNew();
          }}
          icon={<Plus />}
          aria-label="New project"
        >
          <span className="studio-nav-label">New project</span>
        </AppButton>
      </AppTooltip>
      <nav aria-label="Studio navigation" className="studio-navigation">
        <AppTooltip content="Projects">
          <Link
            href="/dashboard"
            className="studio-nav-item active"
            aria-current="page"
            aria-label="Projects"
            onClick={onNavigate}
          >
            <FolderOpen size={18} />
            <span className="studio-nav-label">Projects</span>
          </Link>
        </AppTooltip>
        <p className="studio-nav-section studio-nav-label">LIBRARY</p>
        <AppTooltip content="From Blynta">
          <AppButton
            variant="ghost"
            className="studio-nav-item"
            aria-label="From Blynta"
            onClick={() => {
              onNavigate?.();
              onBlynta();
            }}
          >
            <Clapperboard size={18} />
            <span className="studio-nav-label">From Blynta</span>
          </AppButton>
        </AppTooltip>
      </nav>
      <div className="studio-sidebar-bottom">
        <p className="studio-nav-hint studio-nav-label">
          Your media library and Blynta AI are available inside each project.
        </p>
        <AppTooltip content="Back to Blynta">
          <a
            href={blyntaUrl}
            className="studio-nav-item"
            aria-label="Back to Blynta"
          >
            <ArrowUpLeft size={18} />
            <span className="studio-nav-label">Back to Blynta</span>
          </a>
        </AppTooltip>
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
    <header className="workspace-header">
      <div className="flex min-w-0 items-center gap-3">
        <AppButton
          variant="ghost"
          size="icon-sm"
          className="studio-mobile-menu"
          onClick={onMenu}
          aria-label="Open Studio navigation"
        >
          <Menu />
        </AppButton>
        <AppTooltip content={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
          <AppButton
            variant="ghost"
            size="icon-sm"
            className="studio-sidebar-toggle"
            onClick={onCollapse}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            aria-controls="studio-sidebar"
          >
            {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          </AppButton>
        </AppTooltip>
        <Link href="/dashboard" aria-label="Blynta Studio projects">
          <StudioLogo />
        </Link>
      </div>
      <div className="flex items-center gap-1">
        <ThemeToggle />
        <UserDropdown />
      </div>
    </header>
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
    <div className={`studio-workspace ${collapsed ? "sidebar-collapsed" : ""}`}>
      <a href="#studio-content" className="studio-skip-link">
        Skip to projects
      </a>
      <StudioHeader
        collapsed={collapsed}
        onCollapse={() => setCollapsed(!collapsed)}
        onMenu={() => setMobileOpen(true)}
      />
      <aside id="studio-sidebar" className="studio-sidebar">
        <StudioSidebar onNew={onNew} onBlynta={onBlynta} />
      </aside>
      <main id="studio-content" className="studio-workspace-main" tabIndex={-1}>
        {children}
      </main>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="studio-navigation-sheet">
          <SheetHeader>
            <SheetTitle>Blynta Studio</SheetTitle>
            <SheetDescription>Your editing workspace</SheetDescription>
          </SheetHeader>
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
