import { BillingView } from "@/features/admin-billing/components/BillingView";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Billing — Blynta Admin",
  description: "Manage Paddle customers and subscription events.",
};

export default function BillingPage() {
  return <BillingView />;
}
