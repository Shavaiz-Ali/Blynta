"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { AppButton, AppDialog } from "@blynta/ui";

export function ClipFailureDetailsDialog({
  open,
  onOpenChange,
  index,
  title,
  fields,
  available,
  pending,
  onRetry,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  index: number;
  title: string;
  fields: string[][];
  available: boolean;
  pending: boolean;
  onRetry: () => Promise<void>;
}) {
  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      title={
        <span className="flex items-center gap-2.5">
          <AlertTriangle
            aria-hidden="true"
            className="size-5 shrink-0 text-destructive/80"
          />
          Clip processing failed
        </span>
      }
      description={`Clip ${String(index + 1).padStart(2, "0")} · ${title}`}
      titleClassName="pr-6 text-lg leading-snug"
      descriptionClassName="pr-6 break-words [overflow-wrap:anywhere]"
      contentClassName="max-h-[calc(100dvh-2rem)] overflow-y-auto"
      footer={
        <>
          <AppButton variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </AppButton>
          {available && (
            <AppButton
              icon={<RefreshCw aria-hidden="true" className="size-4" />}
              isLoading={pending}
              disabled={pending}
              onClick={onRetry}
            >
              {pending ? "Submitting…" : "Retry clip"}
            </AppButton>
          )}
        </>
      }
    >
      <dl className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 text-sm">
        {fields.map(([label, value]) => (
          <div
            key={label}
            className={`min-w-0 space-y-1.5 ${label === "Attempt" || label === "Retry availability" ? "" : "sm:col-span-2"}`}
          >
            <dt className="text-xs font-medium text-muted-foreground">
              {label}
            </dt>
            <dd
              className="break-words leading-relaxed text-foreground/90 [overflow-wrap:anywhere]"
              suppressHydrationWarning={label === "Failed at"}
            >
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </AppDialog>
  );
}
