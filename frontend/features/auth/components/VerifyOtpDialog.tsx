"use client";

import * as React from "react";
import { AppDialog } from "@/components/common/AppDialog";
import { AppButton } from "@/components/common/AppButton";
import { OtpInput } from "@/components/common/OtpInput";

export interface VerifyOtpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email?: string;
  length?: number;
  onVerify?: (code: string) => void;
  onResend?: () => void;
  verifying?: boolean;
  resendCountdown?: number;
  error?: string;
  helperText?: string;
}

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = String(seconds % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function VerifyOtpDialog({
  open,
  onOpenChange,
  email = "your email",
  length = 6,
  onVerify,
  onResend,
  verifying = false,
  resendCountdown = 0,
  error,
  helperText = "Didn't receive the code? Check your spam folder.",
}: VerifyOtpDialogProps) {
  const [code, setCode] = React.useState("");
  const [localError, setLocalError] = React.useState<string | undefined>(
    undefined
  );
  const [localCountdown, setLocalCountdown] = React.useState(45);

  function resetLocalState() {
    setCode("");
    setLocalError(undefined);
    setLocalCountdown(45);
  }

  function openDialog() {
    resetLocalState();
  }

  function handleOpenChange(next: boolean) {
    if (next) openDialog();
    onOpenChange(next);
  }

  React.useEffect(() => {
    if (!open) return;
    if (localCountdown <= 0) return;
    const t = window.setInterval(() => {
      setLocalCountdown((c) => (c <= 1 ? 0 : c - 1));
    }, 1000);
    return () => window.clearInterval(t);
  }, [open, localCountdown]);

  const displayError = error ?? localError;
  const displayCountdown = resendCountdown > 0 ? resendCountdown : localCountdown;
  const canResend = displayCountdown <= 0 && !verifying;

  function handleVerify() {
    if (code.length < length) {
      setLocalError(`Please enter the ${length}-digit code`);
      return;
    }
    setLocalError(undefined);
    onVerify?.(code);
  }

  function handleResend() {
    if (!canResend) return;
    setCode("");
    setLocalError(undefined);
    setLocalCountdown(45);
    onResend?.();
  }

  return (
    <AppDialog
      open={open}
      onOpenChange={handleOpenChange}
      size="md"
      title="Verify your email"
      description={
        <span>
          We&apos;ve sent a 6-digit verification code to{" "}
          <span className="font-medium text-foreground">{email}</span>. Enter
          it below to continue.
        </span>
      }
      footer={
        <>
          <AppButton
            variant="outline"
            type="button"
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </AppButton>
          <AppButton
            type="button"
            isLoading={verifying}
            onClick={handleVerify}
          >
            Verify
          </AppButton>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <OtpInput
          value={code}
          onChange={(v) => {
            setCode(v);
            if (displayError && v.length === length) setLocalError(undefined);
          }}
          length={length}
          error={displayError}
          helperText={helperText}
          required
        />
        <div className="flex justify-center">
          <button
            type="button"
            onClick={handleResend}
            disabled={!canResend}
            className={
              "text-sm font-medium underline-offset-4 hover:underline transition-colors " +
              (!canResend
                ? "text-muted-foreground cursor-not-allowed hover:no-underline"
                : "text-primary")
            }
          >
            {displayCountdown > 0
              ? `Resend in ${formatCountdown(displayCountdown)}`
              : "Resend code"}
          </button>
        </div>
      </div>
    </AppDialog>
  );
}

export { VerifyOtpDialog };
