"use client";

import * as React from "react";
import { AppCard } from "@/components/common/AppCard";
import { ShieldCheck, ArrowUpRight } from "lucide-react";

export function SocialAccountsSecurityCard() {
  return (
    <AppCard
      className="rounded-lg border-border/60 bg-muted/20"
      useDefaultClasses={false}
      contentClassName="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 w-full"
    >
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0 mt-0.5">
          <ShieldCheck className="h-4.5 w-4.5" />
        </div>
        <div className="space-y-0.5">
          <h3 className="text-xs font-bold text-foreground">
            OAuth 2.0 Security &amp; Data Privacy
          </h3>
          <p className="text-[11px] text-muted-foreground leading-relaxed max-w-2xl">
            Blynta uses official platform APIs. Your social passwords are never stored. Access tokens are AES-256 encrypted at rest and can be revoked at any time.
          </p>
        </div>
      </div>

      <a
        href="https://myaccount.google.com/permissions"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline shrink-0"
      >
        Google Permissions
        <ArrowUpRight className="h-3.5 w-3.5" />
      </a>
    </AppCard>
  );
}
