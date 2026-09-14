"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { AppButton } from "@/components/common/AppButton";
import { ShieldIcon, CheckIcon, KeyRoundIcon, GoogleIcon, FacebookIcon } from "@/features/dashboard/icons";
import type { UserProfile } from "@/features/auth/types";

function ProviderRow({
  icon,
  name,
  detail,
  isLinked,
}: {
  icon: React.ReactNode;
  name: string;
  detail: string;
  isLinked: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-3.5 gap-4 first:pt-0 last:pb-0">
      <div className="flex items-center gap-3 min-w-0">
        <div className="shrink-0 h-9 w-9 rounded-lg bg-muted/60 border border-border/50 flex items-center justify-center text-muted-foreground">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-foreground">{name}</p>
          <p className="text-[11px] text-muted-foreground font-mono truncate">{detail}</p>
        </div>
      </div>
      <div className="shrink-0">
        {isLinked ? (
          <Badge className="text-[10px] px-2 h-5 font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 flex items-center gap-1">
            <CheckIcon className="h-2.5 w-2.5" />
            Linked
          </Badge>
        ) : (
          <div className="flex items-center gap-1.5 opacity-40 cursor-not-allowed select-none">
            <AppButton size="sm" variant="outline" disabled className="h-6 text-[11px] px-2 pointer-events-none">
              Connect
            </AppButton>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted rounded px-1.5 py-0.5">
              Soon
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export function ProfileConnectedAccountsCard({ profile }: { profile: UserProfile }) {
  const linked = profile.linkedAccounts ?? [];
  const hasLocal = linked.some((a) => a.provider === "local") || linked.length === 0;
  const hasGoogle = linked.some((a) => a.provider === "google");
  const hasFacebook = linked.some((a) => a.provider === "facebook");

  return (
    <div className="rounded-xl border border-border/80 bg-card shadow-xs overflow-hidden">
      <div className="px-6 pt-5 pb-3 flex items-center gap-2.5">
        <div className="p-2 rounded-lg bg-primary/10">
          <ShieldIcon className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-foreground">Connected Accounts</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Authentication providers linked to your profile
          </p>
        </div>
      </div>

      <div className="px-6 pb-4 divide-y divide-border/50">
        <ProviderRow
          icon={<KeyRoundIcon className="h-4 w-4" />}
          name="Email &amp; Password"
          detail={profile.email}
          isLinked={hasLocal}
        />
        <ProviderRow
          icon={<GoogleIcon className="h-4 w-4" />}
          name="Google"
          detail={hasGoogle ? "Connected with Google" : "Sign in with Google"}
          isLinked={hasGoogle}
        />
        <ProviderRow
          icon={<FacebookIcon className="h-4 w-4" />}
          name="Facebook"
          detail={hasFacebook ? "Connected with Facebook" : "Sign in with Facebook"}
          isLinked={hasFacebook}
        />
      </div>
    </div>
  );
}
