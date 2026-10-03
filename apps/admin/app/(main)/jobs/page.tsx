import { JobsView } from "@/features/admin-jobs/components/JobsView";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Jobs — Blynta Admin",
  description: "Monitor and inspect video processing jobs.",
};

export default function JobsPage() {
  return <JobsView />;
}
