"use client";

import { useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClockAlert,
  Link2Off,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  WifiOff,
} from "lucide-react";
import { AppButton, AppInput, Skeleton } from "@blynta/ui";
import { ApiError } from "@/config/axiosClient";
import { passwordSchema } from "@/lib/validators/auth.schema";
import { AuthCard } from "./AuthCard";
import { useResetPassword, useResetTokenValidation } from "../reset-password";

function ResetCard({ children }: { children: ReactNode }) {
  return (
    <AuthCard
      footer={
        <Link
          href="/login"
          className="inline-flex items-center gap-2 rounded-md text-sm font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="size-4" aria-hidden="true" /> Back to sign in
        </Link>
      }
    >
      <section
        className="flex min-h-[420px] flex-col"
        aria-live="polite"
        aria-atomic="false"
      >
        {children}
      </section>
    </AuthCard>
  );
}

function Heading({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-6 space-y-3">
      <div className="mb-5 flex size-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
        {icon}
      </div>
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

export function ResetPasswordLoading() {
  return (
    <ResetCard>
      <div role="status" aria-busy="true">
        <Heading
          icon={<ShieldCheck className="size-6" aria-hidden="true" />}
          title="Verifying your reset link"
          description="Please wait while we securely check your link."
        />
        <div className="space-y-5" aria-hidden="true">
          <div className="space-y-2">
            <Skeleton className="h-3 w-24 motion-reduce:animate-none" />
            <Skeleton className="h-10 w-full motion-reduce:animate-none" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3 w-28 motion-reduce:animate-none" />
            <Skeleton className="h-10 w-full motion-reduce:animate-none" />
          </div>
          <Skeleton className="h-4 w-3/4 motion-reduce:animate-none" />
          <Skeleton className="h-10 w-full motion-reduce:animate-none" />
        </div>
      </div>
    </ResetCard>
  );
}

export function ResetPasswordFlow() {
  const search = useSearchParams();
  const token = search.get("token") ?? "";
  // New URL tokens must never inherit a previous link's validated state.
  return <ResetFlow key={token} token={token} />;
}

function ResetFlow({ token }: { token: string }) {
  const validation = useResetTokenValidation(token);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmError, setConfirmError] = useState("");
  const reset = useResetPassword(token, password);
  const malformed = !/^[a-f0-9]{64}$/.test(token);
  const rejected =
    reset.error instanceof ApiError &&
    reset.error.code === "TOKEN_INVALID_OR_EXPIRED";

  if (reset.isSuccess)
    return (
      <ResetCard>
        <Heading
          icon={<CheckCircle2 className="size-6" aria-hidden="true" />}
          title="Password updated"
          description="Your password has been updated successfully. You can now sign in with your new password."
        />
        <p className="text-sm leading-relaxed text-muted-foreground">
          For your security, your previous sessions have been signed out.
        </p>
        <AppButton
          className="mt-auto h-10 w-full"
          onClick={() => window.location.assign("/login")}
        >
          Continue to sign in{" "}
          <ArrowRight className="size-4" aria-hidden="true" />
        </AppButton>
      </ResetCard>
    );

  if (malformed || rejected || validation.data?.valid === false)
    return (
      <ResetCard>
        <Heading
          icon={
            malformed ? (
              <Link2Off className="size-6" aria-hidden="true" />
            ) : (
              <ClockAlert className="size-6" aria-hidden="true" />
            )
          }
          title={
            malformed
              ? "Invalid password reset link"
              : "Password reset link expired"
          }
          description={
            malformed
              ? "This reset link is missing or incomplete. Request a new link to securely update your password."
              : "This password reset link is no longer valid. For security reasons, reset links can only be used once and for a limited time."
          }
        />
        <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm leading-relaxed text-muted-foreground">
          Request a fresh link and use the most recent email in your inbox.
        </div>
        <AppButton
          className="mt-auto h-10 w-full"
          onClick={() => window.location.assign("/forgot-password")}
        >
          Request a new link{" "}
          <ArrowRight className="size-4" aria-hidden="true" />
        </AppButton>
      </ResetCard>
    );

  if (validation.isError && !validation.isFetching)
    return (
      <ResetCard>
        <Heading
          icon={<WifiOff className="size-6" aria-hidden="true" />}
          title="Unable to verify your link"
          description="We couldn't verify your password reset link right now. Please check your connection and try again."
        />
        {validation.error instanceof ApiError &&
          validation.error.status === 429 && (
            <p className="text-sm text-muted-foreground">
              Too many attempts. Please wait a minute before trying again.
            </p>
          )}
        <AppButton
          className="mt-auto h-10 w-full"
          onClick={() => void validation.refetch()}
        >
          <RefreshCw className="size-4" aria-hidden="true" /> Try again
        </AppButton>
      </ResetCard>
    );

  if (validation.isFetching || !validation.data)
    return <ResetPasswordLoading />;

  return (
    <ResetCard>
      <Heading
        icon={<LockKeyhole className="size-6" aria-hidden="true" />}
        title="Create a new password"
        description="Choose a strong password to keep your Blynta account secure."
      />
      <form
        className="flex flex-1 flex-col gap-4"
        noValidate
        onSubmit={async (event) => {
          event.preventDefault();
          if (reset.isPending) return;
          reset.reset();
          const result = passwordSchema.safeParse(password);
          setPasswordError(
            result.success ? "" : result.error.issues[0].message,
          );
          setConfirmError(
            password !== confirmPassword ? "Passwords do not match." : "",
          );
          if (!result.success || password !== confirmPassword) return;
          try {
            await reset.mutateAsync();
            setPassword("");
            setConfirmPassword("");
          } catch {
            // Typed token errors replace the form. Transport errors allow retry.
          }
        }}
      >
        <AppInput
          label="New password"
          name="newPassword"
          type="password"
          size="lg"
          autoComplete="new-password"
          required
          minLength={8}
          disabled={reset.isPending}
          value={password}
          helperText="At least 8 characters, including a letter and a number."
          error={passwordError}
          onChange={(event) => {
            setPassword(event.target.value);
            setPasswordError("");
            setConfirmError("");
          }}
        />
        <AppInput
          label="Confirm password"
          name="confirmPassword"
          type="password"
          size="lg"
          autoComplete="new-password"
          required
          disabled={reset.isPending}
          value={confirmPassword}
          error={confirmError}
          onChange={(event) => {
            setConfirmPassword(event.target.value);
            setConfirmError("");
          }}
        />
        {reset.isError && (
          <p role="alert" className="text-sm text-destructive">
            {reset.error instanceof ApiError && reset.error.status === 429
              ? "Too many attempts. Please wait a minute and try again."
              : reset.error instanceof ApiError &&
                  reset.error.code === "VALIDATION_ERROR"
                ? "Use at least 8 characters, including a letter and a number."
                : "We couldn't update your password right now. Please check your connection and try again."}
          </p>
        )}
        <AppButton
          type="submit"
          className="mt-auto h-10 w-full"
          isLoading={reset.isPending}
          disabled={reset.isPending}
        >
          {reset.isPending ? "Updating password…" : "Reset password"}
        </AppButton>
      </form>
    </ResetCard>
  );
}
