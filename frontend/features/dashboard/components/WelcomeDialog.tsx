"use client";

import * as React from "react";
import { AppDialog } from "@/components/common/AppDialog";
import { AppButton } from "@/components/common/AppButton";
import { BlyntaLogo } from "@/components/logo";
import { useMarkWelcomed } from "@/features/auth/queries";

export interface WelcomeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creditsBalance: number;
}

function WelcomeDialog({ open, onOpenChange, creditsBalance }: WelcomeDialogProps) {
  const { mutate: markWelcomed, isPending: isSubmitting } = useMarkWelcomed();

  function handleCreateFirstClip() {
    markWelcomed(undefined, {
      onError: (err) => {
        console.warn(
          "[welcome] markWelcomed API call failed; dismissing dialog anyway",
          err
        );
      },
    });

    onOpenChange(false);
  }

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      showCloseButton={false}
      size="md"
      footer={
        <AppButton
          size="lg"
          className="w-full sm:w-auto font-semibold shadow-md hover:shadow-lg transition-all"
          isLoading={isSubmitting}
          onClick={handleCreateFirstClip}
        >
          Create my first clip
        </AppButton>
      }
    >
      <div className="flex flex-col items-center text-center gap-5 pt-2">
        <BlyntaLogo size="lg" />

        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Welcome to Blynta
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground max-w-sm">
            Paste a video link and we&apos;ll turn it into share-worthy clips with
            captions — powered by AI.
          </p>
        </div>

        <div className="w-full rounded-xl bg-muted/60 border border-border/60 px-4 py-3">
          <p className="text-sm text-muted-foreground">
            You&apos;ve got{" "}
            <span className="font-semibold text-foreground">
              {creditsBalance} free credit{creditsBalance === 1 ? "" : "s"}
            </span>{" "}
            to start — each video you process uses 1 credit.
          </p>
        </div>
      </div>
    </AppDialog>
  );
}

export { WelcomeDialog };
