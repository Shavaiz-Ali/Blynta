import { DashboardView } from "@/features/admin-dashboard/components/DashboardView";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard — Blynta Admin",
  description: "Platform overview for Blynta admins.",
};

export default function DashboardPage() {
  return <DashboardView />;
}
