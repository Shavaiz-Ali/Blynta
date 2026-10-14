"use client";
import Link from "next/link";
import { logoutProduct } from "@blynta/auth/client";
import { AppAccountMenu, type AppAccountIdentity } from "@blynta/ui";
export function UserDropdown({ profile }: { profile: AppAccountIdentity }) {
  return (
    <AppAccountMenu
      profile={profile}
      links={[
        { label: "Profile", render: <Link href="/profile" /> },
        { label: "Billing & Plan", render: <Link href="/billing" /> },
      ]}
      onSignOut={(onSuccess) => logoutProduct({ onSuccess })}
    />
  );
}
