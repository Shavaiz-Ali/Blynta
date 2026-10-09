"use client";

import { AppButton, AppDialog } from "@blynta/ui";
import { Film, Scissors, ShieldCheck } from "lucide-react";
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
      description="Simple, usage-based pricing."
      size="lg"
      contentClassName="flex max-h-[calc(100dvh-2rem)] flex-col sm:max-w-[740px]"
      titleClassName="pr-8 leading-tight"
      descriptionClassName="mt-0"
      bodyClassName="min-h-0 overflow-y-auto py-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      footer={
        <AppButton className="h-10" onClick={() => onOpenChange(false)}>
          Got it
        </AppButton>
      }
    >
      <div className="space-y-4">
        {pricing ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-muted/20 p-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <Film
                    className="size-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                  Source video
                </h3>
                <p className="mt-1 text-lg font-bold">
                  1 credit{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    per {pricing.sourceSeconds / 60} minutes
                  </span>
                </p>
              </div>
              <div className="rounded-xl border border-border bg-muted/20 p-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <Scissors
                    className="size-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                  Generated clips
                </h3>
                <p className="mt-1 text-lg font-bold">
                  1 credit{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    per{" "}
                    {pricing.outputSeconds === 60
                      ? "minute"
                      : `${pricing.outputSeconds} seconds`}
                  </span>
                </p>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  Combined generated clip duration.
                </p>
              </div>
            </div>
            {balance.clipExample && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    For example
                  </p>
                  <p className="mt-1 text-sm">
                    30 minutes of source + 3 minutes of clips
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {balance.clipExample.sourceCredits} source +{" "}
                    {balance.clipExample.renderCredits} output
                  </p>
                </div>
                <p className="text-xl font-semibold tracking-tight">
                  {balance.clipExample.totalCredits} credits total
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
        <div className="flex gap-2.5">
          <ShieldCheck
            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <p className="text-sm leading-relaxed text-muted-foreground">
            Credits are reserved before processing. Unused credits are returned,
            and your final charge never exceeds what you approve.
          </p>
        </div>
        {pricing && (
          <p className="text-xs leading-relaxed text-muted-foreground">
            Source duration is rounded up in {pricing.sourceSeconds / 60}-minute
            units; combined clip output in {pricing.outputSeconds / 60}-minute
            units, rounded up once per job.
          </p>
        )}
      </div>
    </AppDialog>
  );
}
