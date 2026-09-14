"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthCard } from "@/features/auth/components/AuthCard";
import { SignupForm, type SignupFormValues } from "@/features/auth/components/SignupForm";
import { VerifyOtpDialog } from "@/features/auth/components/VerifyOtpDialog";
import { AuthDivider } from "@/features/auth/components/AuthDivider";
import { SocialLoginButtons } from "@/features/auth/components/SocialLoginButtons";
import type { AuthProvider } from "@/features/auth/types";
import { useSignup, useVerifyOtp, useResendOtp } from "@/features/auth/queries";

import { toast } from "sonner";
import { signIn } from "next-auth/react";

export interface SignupContainerProps {
  /** Enabled provider strings from GET /auth/providers (e.g. ["local","google","facebook"]) */
  enabledProviders?: AuthProvider[];
}

function SignupContainerInner({ enabledProviders }: SignupContainerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const refCode = searchParams.get("ref") || undefined;

  const [currentEmail, setCurrentEmail] = React.useState("");
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [socialLoading, setSocialLoading] = React.useState<
    "facebook" | "google" | null
  >(null);
  const [otpOpen, setOtpOpen] = React.useState(false);

  const signupMutation = useSignup({
    onSuccess: (data) => {
      setOtpOpen(true);
      toast.success(
        `Verification code sent to ${data.email}. Please check your inbox!`
      );
    },
    onError: (err: any) => {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to create account. Please try again.";
      toast.error(message);
    },
  });

  const verifyOtpMutation = useVerifyOtp({
    onSuccess: async () => {
      setOtpOpen(false);
      toast.success("Email verified successfully! Signing you in...");

      try {
        const result = await signIn("credentials", {
          email: currentEmail,
          password: currentPassword,
          redirect: false,
        });

        if (result?.error) {
          toast.info("Account verified. Please sign in with your credentials.");
          router.push("/login");
          return;
        }

        router.push("/dashboard");
        router.refresh();
      } catch {
        router.push("/login");
      }
    },
    onError: (err: any) => {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        "Invalid or expired verification code.";
      toast.error(message);
    },
  });

  const resendOtpMutation = useResendOtp({
    onSuccess: (data) => {
      toast.info(data.message || "Verification code resent to your email.");
    },
    onError: (err: any) => {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to resend code. Please try again.";
      toast.error(message);
    },
  });

  function handleSubmit(values: SignupFormValues) {
    setCurrentEmail(values.email);
    setCurrentPassword(values.password);

    signupMutation.mutate({
      name: values.name,
      email: values.email,
      password: values.password,
      ref: refCode,
    });
  }

  async function handleSocial(provider: "facebook" | "google") {
    setSocialLoading(provider);
    toast.info(
      `Connecting to ${provider.charAt(0).toUpperCase() + provider.slice(1)}...`
    );
    try {
      await signIn(provider); // Auth.js handles the redirect automatically
    } catch {
      // signIn() with OAuth redirects away; an error here is unexpected.
      toast.error(`Failed to connect to ${provider}. Please try again.`);
      setSocialLoading(null);
    }
  }

  function handleOtpVerify(code: string) {
    if (!currentEmail) return;
    verifyOtpMutation.mutate({
      email: currentEmail,
      otp: code,
    });
  }

  function handleOtpResend() {
    if (!currentEmail) return;
    resendOtpMutation.mutate(currentEmail);
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
        isSubmitting={signupMutation.isPending}
      />

      <VerifyOtpDialog
        open={otpOpen}
        onOpenChange={setOtpOpen}
        email={currentEmail || "your email"}
        onVerify={handleOtpVerify}
        onResend={handleOtpResend}
        verifying={verifyOtpMutation.isPending}
      />
    </AuthCard>
  );
}

export function SignupContainer(props: SignupContainerProps) {
  return (
    <React.Suspense fallback={null}>
      <SignupContainerInner {...props} />
    </React.Suspense>
  );
}
