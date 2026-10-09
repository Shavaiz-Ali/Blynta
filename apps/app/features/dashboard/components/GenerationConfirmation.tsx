"use client";

import { AppButton, AppDialog, InsufficientCredits } from "@blynta/ui";
import { Film, Scissors } from "lucide-react";
import type { CreditEstimate } from "@blynta/types";

function duration(seconds?: number) {
  if (seconds === undefined) return "Unavailable";
  const wholeSeconds = Math.ceil(seconds);
  const minutes = Math.floor(wholeSeconds / 60);
  const remainder = wholeSeconds % 60;
  return remainder ? `${minutes}m ${remainder}s` : `${minutes} min`;
}

export function GenerationConfirmation({
  estimate,
  available,
  busy,
  checking,
  enabled,
  error,
  onCancel,
  onApprove,
}: {
  estimate?: CreditEstimate;
  available: number;
  busy: boolean;
  checking: boolean;
  enabled: boolean;
  error?: string;
  onCancel: () => void;
  onApprove: () => void;
}) {
  const insufficient = !!estimate && estimate.totalCredits > available;
  const target = estimate?.clipTargetMax
    ? String(estimate.clipTargetMax)
    : undefined;
  return (
    <AppDialog
      open={!!estimate}
      onOpenChange={(open) => {
        if (!open && !busy) onCancel();
      }}
      title="Ready to create your clips?"
      description="Review your video and credit estimate."
      size="lg"
      contentClassName="flex max-h-[calc(100dvh-2rem)] flex-col sm:max-w-[640px]"
      titleClassName="pr-8 leading-tight"
      descriptionClassName="mt-0"
      bodyClassName="min-h-0 overflow-y-auto py-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      dismissible={!busy}
      showCloseButton={!busy}
      footer={
        <>
          <AppButton
            variant="outline"
            className="h-10"
            disabled={busy}
            onClick={onCancel}
          >
            Cancel
          </AppButton>
          <AppButton
            className="h-10"
            isLoading={busy}
            disabled={busy || !estimate || !enabled || insufficient}
            onClick={onApprove}
          >
            {checking ? (
              "Checking estimate…"
            ) : busy ? (
              "Starting generation…"
            ) : (
              <>
                <span>Generate clips</span>
                <span className="text-xs font-normal opacity-80">
                  · Up to {estimate?.totalCredits} credits
                </span>
              </>
            )}
          </AppButton>
        </>
      }
    >
      {estimate && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-muted/20 p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Maximum credits reserved
                </p>
                <p className="mt-1 text-4xl font-semibold tracking-tight tabular-nums">
                  {estimate.totalCredits}
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    credits
                  </span>
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                Available balance:{" "}
                <span className="tabular-nums">{available}</span> credits
              </p>
            </div>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <dt className="flex min-w-0 gap-2 text-muted-foreground">
                  <Film className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <span>Source video · {duration(estimate.sourceSeconds)}</span>
                </dt>
                <dd className="shrink-0 font-medium tabular-nums">
                  {estimate.sourceCredits} credits
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="flex min-w-0 gap-2 text-muted-foreground">
                  <Scissors
                    className="mt-0.5 size-4 shrink-0"
                    aria-hidden="true"
                  />
                  <span>
                    Generated clips · up to{" "}
                    {duration(estimate.maxOutputSeconds)} total
                  </span>
                </dt>
                <dd className="shrink-0 font-medium tabular-nums">
                  {estimate.renderCredits} credits
                </dd>
              </div>
            </dl>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Blynta selects the best moments
            {target
              ? `, creating up to ${target} strong clips based on the content and your selected style`
              : ""}
            .
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            You approve a maximum reservation of{" "}
            <strong className="font-medium text-foreground">
              {estimate.totalCredits} credits
            </strong>
            . Your final charge may be lower, and unused credits are returned.
          </p>
          {error && (
            <p role="alert" className="text-sm text-amber-400">
              {error}
            </p>
          )}
          {insufficient && (
            <InsufficientCredits
              required={estimate.totalCredits}
              available={available}
              billingUrl="/billing"
              billingLabel="View plans & upgrade"
            />
          )}
        </div>
      )}
    </AppDialog>
  );
}
