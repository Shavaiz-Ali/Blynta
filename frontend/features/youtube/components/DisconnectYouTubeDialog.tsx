"use client";

import * as React from "react";
import { AppDialog } from "@/components/common/AppDialog";
import { AppButton } from "@/components/common/AppButton";
import { AlertTriangle, Unlink } from "lucide-react";

export interface DisconnectYouTubeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channelTitle?: string;
  isPending: boolean;
  onConfirm: () => void;
}

export function DisconnectYouTubeDialog({
  open,
  onOpenChange,
  channelTitle,
  isPending,
  onConfirm,
}: DisconnectYouTubeDialogProps) {
  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      title={
        <div className="flex items-center gap-2 text-foreground font-bold">
          <div className="h-8 w-8 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <span>Disconnect YouTube Channel?</span>
        </div>
      }
      description={
        <span>
          You will no longer be able to publish clips directly to{" "}
          <strong className="text-foreground font-semibold">
            {channelTitle || "this channel"}
          </strong>{" "}
          from Blynta. Your existing clips and publications on YouTube will not be deleted or modified.
        </span>
      }
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <AppButton
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
            className="rounded-lg h-8 text-xs font-semibold"
          >
            Cancel
          </AppButton>
          <AppButton
            variant="destructive"
            size="sm"
            isLoading={isPending}
            icon={<Unlink className="h-3.5 w-3.5" />}
            onClick={onConfirm}
            className="rounded-lg h-8 text-xs font-semibold"
          >
            Disconnect Channel
          </AppButton>
        </div>
      }
    />
  );
}
