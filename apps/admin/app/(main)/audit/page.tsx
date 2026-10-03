import { AuditView } from "@/features/admin-audit/components/AuditView";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Audit Log — Blynta Admin",
  description: "Immutable record of all admin actions.",
};

export default function AuditPage() {
  return <AuditView />;
}
