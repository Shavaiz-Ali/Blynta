import { UsersView } from "@/features/admin-users/components/UsersView";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Users — Blynta Admin",
  description: "Manage and inspect all Blynta user accounts.",
};

export default function UsersPage() {
  return <UsersView />;
}
