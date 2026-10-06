"use client";
import Link from "next/link";
import { toast } from "sonner";
import { logoutProduct } from "@blynta/auth/client";
import { AppAccountMenu } from "@blynta/ui";
import type { UserProfile } from "@/features/auth/types";
export function UserDropdown({ profile }: { profile: UserProfile }) {
  return (
    <AppAccountMenu
      profile={profile}
      links={[
        { label: "Profile", render: <Link href="/profile" /> },
        { label: "Billing & Plan", render: <Link href="/billing" /> },
      ]}
      onSignOut={() => {
        toast.info("Logged out of session.");
        void logoutProduct();
      }}
    />
  );
}
