"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AccountControls } from "./AccountControls";
import { useSession } from "next-auth/react";
import { AppIdentityAvatar } from "@blynta/ui";
import {
  AppButton,
  AppProductHeader,
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
  Plus,
  Clapperboard,
  Home,
  Sparkles,
  LayoutTemplate,
  Images,
  Zap,
  Bell,
} from "lucide-react";
import { StudioLogo } from "@/components/common/StudioLogo";
import { blyntaUrl } from "@/config/env";

export function StudioSidebar({
  onNew,
  onAI,
  onNavigate,
  collapsed = false,
}: {
  onNew: () => void;
  onAI?: () => void;
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const navigate = (action: () => void) => {
    onNavigate?.();
    action();
  };
  return (
    <div className="flex h-full flex-col gap-2 overflow-x-hidden overflow-y-auto">
      <Link
        href="/home"
        onClick={onNavigate}
        className="flex h-14 shrink-0 items-center px-3.5 overflow-hidden"
        aria-label="Blynta Studio home"
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
        {[
          {
            title: "Workspace",
            items: [
              { label: "Home", href: "/home", icon: Home },
              { label: "Projects", href: "/dashboard", icon: FolderOpen },
            ],
          },
          {
            title: "Create",
            items: [
              {
                label: "Blynta AI",
                action: () => navigate(onAI || onNew),
                icon: Sparkles,
              },
              { label: "Templates", disabled: true, icon: LayoutTemplate },
            ],
          },
          {
            title: "Library",
            items: [
              { label: "My media", href: "/media", icon: Images },
              {
                label: "From Blynta",
                href: "/from-blynta",
                icon: Clapperboard,
              },
            ],
          },
          {
            title: "Account / Usage",
            items: [
              { label: "Credits / Usage", href: "/usage", icon: Zap },
              { label: "Notifications", href: "/notifications", icon: Bell },
            ],
          },
        ].map((group) => (
          <div key={group.title} className="flex flex-col gap-1">
            {!collapsed && (
              <p className="px-3 pt-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
                {group.title}
              </p>
            )}
            {group.items.map(
              (item: {
                label: string;
                href?: string;
                action?: () => void;
                disabled?: boolean;
                icon: typeof Home;
              }) => (
                <AppSidebarItem
                  key={item.label}
                  label={
                    item.disabled && collapsed
                      ? `${item.label} — Coming soon`
                      : item.label
                  }
                  icon={<item.icon />}
                  collapsed={collapsed}
                  active={pathname === item.href}
                  disabled={item.disabled}
                  badge={
                    item.disabled ? (
                      <span className="text-[9px]">Coming soon</span>
                    ) : undefined
                  }
                  href={item.href}
                  onClick={item.action || onNavigate}
                  renderLink={
                    item.href
                      ? (props) => <Link href={item.href!} {...props} />
                      : undefined
                  }
                />
              ),
            )}
          </div>
        ))}
      </nav>
      <div className="mt-auto border-t border-border/60 p-2.5">
        {!collapsed && (
          <div className="mb-3 flex items-center gap-2.5 rounded-lg bg-muted/30 px-3 py-2.5">
            <AppIdentityAvatar name={session?.user.name || "Blynta"} />
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold">
                {session?.user.name || "Your workspace"}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                Personal workspace
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
  const pathname = usePathname();
  const title =
    (
      {
        "/home": "Home",
        "/dashboard": "Projects",
        "/media": "My media",
        "/from-blynta": "From Blynta",
        "/usage": "Credits / Usage",
        "/notifications": "Notifications",
      } as Record<string, string>
    )[pathname] || "Workspace";
  return (
    <AppProductHeader
      collapsed={collapsed}
      onCollapse={onCollapse}
      onMenu={onMenu}
      sidebarId="studio-sidebar"
    >
      <span className="min-w-0 truncate text-xs font-medium text-muted-foreground">
        Studio <span className="mx-2 text-border">/</span>
        <span className="text-foreground">{title}</span>
      </span>
      <AccountControls />
    </AppProductHeader>
  );
}
export function StudioShell({
  children,
  onNew,
  onAI,
}: {
  children: ReactNode;
  onNew: () => void;
  onAI?: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="flex h-dvh overflow-hidden bg-background text-foreground">
      <a href="#studio-content" className="studio-skip-link">
        Skip to workspace
      </a>
      <AppSidebar id="studio-sidebar" collapsed={collapsed}>
        <StudioSidebar collapsed={collapsed} onNew={onNew} onAI={onAI} />
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
            onAI={onAI}
            onNavigate={() => setMobileOpen(false)}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}
