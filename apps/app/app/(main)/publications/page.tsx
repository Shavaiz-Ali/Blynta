import type { Metadata } from "next";
import { PublicationsPage } from "@/features/youtube";

export const metadata: Metadata = {
  title: "Publications | Blynta",
  description:
    "Track and manage all your published clips across YouTube and connected social channels.",
};

export default function PublicationsRoute() {
  return <PublicationsPage />;
}
