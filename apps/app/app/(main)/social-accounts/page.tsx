import type { Metadata } from "next";
import { SocialAccountsPage } from "@/features/youtube";

export const metadata: Metadata = {
  title: "Social Accounts | Blynta",
  description:
    "Connect and manage your social media accounts like YouTube, TikTok, and Instagram to publish clips directly.",
};

export default function SocialAccountsRoute() {
  return <SocialAccountsPage />;
}
