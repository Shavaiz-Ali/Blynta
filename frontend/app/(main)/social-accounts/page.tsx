import { Suspense } from "react";
import type { Metadata } from "next";
import { SocialAccountsPage } from "@/features/youtube";

export const metadata: Metadata = {
  title: "Social Accounts | Blynta",
  description:
    "Connect and manage your social media accounts like YouTube, TikTok, and Instagram to publish clips directly.",
};

export default function SocialAccountsRoute() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-sm text-muted-foreground">
          Loading social accounts...
        </div>
      }
    >
      <SocialAccountsPage />
    </Suspense>
  );
}
