"use client";

import * as React from "react";
import Link from "next/link";
import { AppButton } from "@/components/common/AppButton";
import { AuthCard } from "@/features/auth/components/AuthCard";
import { SignupForm, type SignupFormValues } from "@/features/auth/components/SignupForm";
import { VerifyOtpDialog } from "@/features/auth/components/VerifyOtpDialog";
import { AuthDivider } from "@/features/auth/components/AuthDivider";
import { SocialLoginButtons } from "@/features/auth/components/SocialLoginButtons";
import type { AuthProvider } from "@/features/auth/types";

export interface SignupContainerProps {
  /** Enabled provider strings from GET /auth/providers (e.g. ["local","google","facebook"]) */
  enabledProviders?: AuthProvider[];
}

export function SignupContainer({ enabledProviders }: SignupContainerProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [socialLoading, setSocialLoading] = React.useState<
    "facebook" | "google" | null
  >(null);
  const [otpOpen, setOtpOpen] = React.useState(false);
  const [otpSubmitting, setOtpSubmitting] = React.useState(false);

  function handleSubmit(values: SignupFormValues) {
    setIsSubmitting(true);
    console.log("signup submit", values);
    window.setTimeout(() => {
      setIsSubmitting(false);
      setOtpOpen(true);
    }, 800);
  }

  function handleSocial(provider: "facebook" | "google") {
    setSocialLoading(provider);
    console.log("social auth", provider);
    window.setTimeout(() => setSocialLoading(null), 800);
  }

  function handleOtpVerify(code: string) {
    setOtpSubmitting(true);
    console.log("verify otp", code);
    window.setTimeout(() => setOtpSubmitting(false), 800);
  }

  function handleOtpResend() {
    console.log("resend otp");
  }

  const showSocialSection =
    !enabledProviders ||
    enabledProviders.includes("google") ||
    enabledProviders.includes("facebook");

  return (
    <AuthCard
      header={
        <>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Create an account
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter your email below to create your account
          </p>
        </>
      }
      footer={
        <p className="text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </p>
      }
    >
      {showSocialSection && (
        <SocialLoginButtons
          onFacebookClick={() => handleSocial("facebook")}
          onGoogleClick={() => handleSocial("google")}
          facebookLoading={socialLoading === "facebook"}
          googleLoading={socialLoading === "google"}
          enabledProviders={enabledProviders}
        />
      )}

      {showSocialSection && (
        <div className="my-5">
          <AuthDivider />
        </div>
      )}

      <SignupForm
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
      />


      <VerifyOtpDialog
        open={otpOpen}
        onOpenChange={setOtpOpen}
        email="your email"
        onVerify={handleOtpVerify}
        onResend={handleOtpResend}
        verifying={otpSubmitting}
      />
    </AuthCard>
  );
}
