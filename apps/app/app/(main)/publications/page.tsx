import { Suspense } from "react";
import type { Metadata } from "next";
import { PublicationsPage } from "@/features/youtube";

export const metadata: Metadata = {
  title: "Publications | Blynta",
  description:
    "Track and manage all your published clips across YouTube and connected social channels.",
};

export default function PublicationsRoute() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-sm text-muted-foreground">
          Loading publications...
        </div>
      }
    >
      <PublicationsPage />
    </Suspense>
  );
}
