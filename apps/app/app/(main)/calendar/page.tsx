import type { Metadata } from "next";
import { SchedulingCalendarPage } from "@/features/youtube/components/SchedulingCalendarPage";

export const metadata: Metadata = {
  title: "Publishing Calendar | Blynta",
  description: "Schedule and manage upcoming social video publications.",
};

export default function CalendarPage() {
  return <SchedulingCalendarPage />;
}
