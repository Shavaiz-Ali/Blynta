import { ActivityPage } from "@/features/activity";

export const metadata = {
  title: "Activity Log — Blynta",
  description:
    "A full timeline of your account activity including jobs, billing, credits, and authentication events.",
};

export default function ActivityRoute() {
  return <ActivityPage />;
}
