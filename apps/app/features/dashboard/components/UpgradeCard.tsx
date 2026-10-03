import * as React from "react";
import Link from "next/link";
import type { UserProfile } from "@/features/auth/types";
import { CrownIcon, ArrowRightIcon } from "../icons";

export function UpgradeCard({ plan }: { plan: UserProfile["plan"] }) {
  if (plan !== "free") return null;
  return (
    <Link
      href="/billing"
      className="group relative block overflow-hidden rounded-xl border border-border bg-gradient-to-br from-primary via-primary to-chart-4 p-4 text-primary-foreground shadow-md hover:shadow-lg transition-all"
    >
      <div className="absolute -top-8 -right-8 h-24 w-24 rounded-full bg-white/10 blur-xl pointer-events-none" />
      <div className="absolute -bottom-8 -left-8 h-24 w-24 rounded-full bg-black/10 blur-xl pointer-events-none" />

      <div className="relative flex items-center gap-2.5 mb-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 backdrop-blur border border-white/20 shrink-0">
          <CrownIcon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider opacity-80 leading-none">
            Free plan
          </p>
          <h4 className="font-bold text-sm leading-snug mt-0.5">
            Upgrade to Pro
          </h4>
        </div>
      </div>
      <p className="relative text-xs opacity-90 leading-relaxed mb-3">
        Unlock 50 monthly credits, HD exports & priority processing.
      </p>
      <div className="relative inline-flex items-center gap-1 text-xs font-semibold group-hover:translate-x-0.5 transition-transform">
        View plans
        <ArrowRightIcon className="h-3.5 w-3.5" />
      </div>
    </Link>
  );
}
