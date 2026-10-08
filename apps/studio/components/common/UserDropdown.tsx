"use client";
import { useSession } from "@blynta/auth/react";
import { logoutProduct } from "@blynta/auth/client";
import { AppAccountMenu } from "@blynta/ui";
import {
  useWorkspaceQuery,
  type AccountProfile,
} from "@/features/studio/dashboard/workspace-api";
import { blyntaUrl } from "@/config/env";
export function UserDropdown() {
  const { data: session } = useSession();
  const { data: profile } = useWorkspaceQuery<AccountProfile>("users/me");
  const base = blyntaUrl.replace(/\/$/, "");
  return (
    <AppAccountMenu
      profile={{
        name: profile?.name || session?.user.name,
        email: session?.user.email,
        avatarUrl: profile?.avatarUrl,
        plan: profile?.plan,
      }}
      links={
        blyntaUrl
          ? [
              { label: "Profile", render: <a href={`${base}/profile`} /> },
              { label: "Settings", render: <a href={`${base}/settings`} /> },
              {
                label: "Billing & Plan",
                render: <a href={`${base}/billing`} />,
              },
              { label: "Back to Blynta", render: <a href={blyntaUrl} /> },
            ]
          : []
      }
      onSignOut={() => {
        void logoutProduct();
      }}
    />
  );
}
