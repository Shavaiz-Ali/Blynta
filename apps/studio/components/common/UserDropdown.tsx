"use client";
import { signOut, useSession } from "next-auth/react";
import { AppDropdownMenu } from "./AppDropdownMenu";
import { AppButton } from "./AppButton";
import { AppAvatar } from "./AppAvatar";
import { LogOut, ExternalLink } from "lucide-react";
import { blyntaUrl } from "@/config/env";
export function UserDropdown() {
  const { data: session } = useSession();
  return (
    <AppDropdownMenu
      trigger={
        <AppButton
          size="icon-sm"
          variant="ghost"
          aria-label={
            session?.user.email
              ? `Account: ${session.user.email}`
              : "Your account"
          }
        >
          <AppAvatar
            name={session?.user.name || session?.user.email || "Blynta"}
          />
        </AppButton>
      }
      items={[
        {
          label: "Open Blynta",
          icon: <ExternalLink />,
          onClick: () => window.location.assign(blyntaUrl),
        },
        {
          label: "Sign out",
          icon: <LogOut />,
          separator: true,
          onClick: () => {
            void signOut({ redirectTo: "/login" });
          },
        },
      ]}
    />
  );
}
