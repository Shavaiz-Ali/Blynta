"use client";

import { AppButton, AppDialog } from "@blynta/ui";
import { Film, Scissors, ShieldCheck, Wallet } from "lucide-react";
import type { CreditBalance } from "@blynta/types";

export function HowCreditsWork({
  open,
  onOpenChange,
  balance,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  balance?: CreditBalance;
}) {
  const pricing = balance?.pricing;
  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      title="How credits work"
      description="Pay for the video you process and the clips you receive."
      size="lg"
      bodyClassName="max-h-[65vh] overflow-y-auto"
      footer={
        <AppButton className="h-10" onClick={() => onOpenChange(false)}>
          Got it
        </AppButton>
      }
    >
      <div className="space-y-5">
        {pricing ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-muted/20 p-4">
                <Film className="mb-3 size-5 text-primary" aria-hidden="true" />
                <h3 className="text-sm font-semibold">Source processing</h3>
                <p className="mt-1 text-lg font-bold">
                  1 credit{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    per {pricing.sourceSeconds / 60} minutes
                  </span>
                </p>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  Your source video duration, rounded up.
                </p>
              </div>
              <div className="rounded-xl border border-border bg-muted/20 p-4">
                <Scissors
                  className="mb-3 size-5 text-primary"
                  aria-hidden="true"
                />
                <h3 className="text-sm font-semibold">Generated clips</h3>
                <p className="mt-1 text-lg font-bold">
                  1 credit{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    per {pricing.outputSeconds} seconds
                  </span>
                </p>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  All billable clips combined, rounded up once per job.
                </p>
              </div>
            </div>
            {balance.clipExample && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                <p className="text-xs font-medium text-primary">For example</p>
                <p className="mt-2 text-sm">
                  30 minutes of source + 3 minutes of clips
                </p>
                <p className="mt-1 text-xl font-bold">
                  {balance.clipExample.totalCredits} credits total
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {balance.clipExample.sourceCredits} for source processing +{" "}
                  {balance.clipExample.renderCredits} for generated clips
                </p>
              </div>
            )}
          </>
        ) : (
          <p role="status" className="text-sm text-muted-foreground">
            Current rates are unavailable. Refresh your credit balance to see
            pricing.
          </p>
        )}
        <div className="flex gap-3">
          <Wallet
            className="mt-0.5 size-4 shrink-0 text-primary"
            aria-hidden="true"
          />
          <div>
            <h3 className="text-sm font-semibold">Reserved before we start</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              We reserve the amount you approve while your video processes.
              Unused credits return to your balance afterward.
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <ShieldCheck
            className="mt-0.5 size-4 shrink-0 text-primary"
            aria-hidden="true"
          />
          <div>
            <h3 className="text-sm font-semibold">You stay in control</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Your final charge cannot exceed the amount you approve. If no
              clips are delivered, the reservation is released.
            </p>
          </div>
        </div>
        {pricing && (
          <p className="border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
            The same balance works in Studio. Basic editing and local previews
            are included; cloud exports use {pricing.studioModifier} credits per{" "}
            {pricing.studioSeconds} seconds, rounded up. Subscription credits
            add to your balance and do not expire under the current policy.
          </p>
        )}
      </div>
    </AppDialog>
  );
}
