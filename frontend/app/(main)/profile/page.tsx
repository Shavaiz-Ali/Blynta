import { Suspense } from "react";
import type { Metadata } from "next";
import { ProfilePage } from "@/features/profile";

export const metadata: Metadata = {
  title: "Account Profile | Blynta",
  description: "Manage your personal profile, credentials, and referral rewards.",
};

export default function ProfileRoute() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-sm text-muted-foreground">
          Loading profile...
        </div>
      }
    >
      <ProfilePage />
    </Suspense>
  );
}
