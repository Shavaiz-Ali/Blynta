import { QueuesView } from "@/features/admin-jobs/components/QueuesView";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Queues & Worker Health — Blynta Admin",
  description: "Monitor BullMQ queues and dedicated background worker processes.",
};

export default function QueuesPage() {
  return <QueuesView />;
}
