import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BarChart3,
  Bell,
  Bot,
  BriefcaseBusiness,
  Clapperboard,
  CreditCard,
  Flag,
  Gauge,
  ListTodo,
  ScrollText,
  Settings,
  Users,
} from "lucide-react";
import type { Permission } from "./permissions";

export interface NavigationItem {
  title: string;
  href: string;
  permission: Permission;
  icon: LucideIcon;
}

export interface NavigationGroup {
  label: string;
  items: NavigationItem[];
}

export const navigation: NavigationGroup[] = [
  {
    label: "Workspace",
    items: [
      {
        title: "Overview",
        href: "/",
        permission: "analytics.read",
        icon: Gauge,
      },
      { title: "Users", href: "/users", permission: "users.read", icon: Users },
    ],
  },
  {
    label: "Content",
    items: [
      {
        title: "Jobs",
        href: "/jobs",
        permission: "jobs.read",
        icon: BriefcaseBusiness,
      },
      {
        title: "Generated clips",
        href: "/clips",
        permission: "jobs.read",
        icon: Clapperboard,
      },
      {
        title: "Processing queues",
        href: "/queues",
        permission: "system.read",
        icon: ListTodo,
      },
    ],
  },
  {
    label: "Business",
    items: [
      {
        title: "AI Management",
        href: "/ai",
        permission: "analytics.read",
        icon: Bot,
      },
      {
        title: "Billing",
        href: "/billing",
        permission: "billing.read",
        icon: CreditCard,
      },
      {
        title: "Analytics",
        href: "/analytics",
        permission: "analytics.read",
        icon: BarChart3,
      },
    ],
  },
  {
    label: "Administration",
    items: [
      {
        title: "Notifications",
        href: "/notifications",
        permission: "system.read",
        icon: Bell,
      },
      {
        title: "System health",
        href: "/system",
        permission: "system.read",
        icon: Activity,
      },
      {
        title: "Audit logs",
        href: "/audit",
        permission: "system.read",
        icon: ScrollText,
      },
      {
        title: "Feature flags",
        href: "/feature-flags",
        permission: "settings.read",
        icon: Flag,
      },
      {
        title: "Settings",
        href: "/settings",
        permission: "settings.read",
        icon: Settings,
      },
    ],
  },
];
