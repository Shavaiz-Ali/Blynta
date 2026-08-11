"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm, Controller, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AppInput } from "@/components/common/AppInput";
import { AppButton } from "@/components/common/AppButton";
import { AuthDivider } from "@/features/auth/components/AuthDivider";
import { SocialLoginButtons } from "@/features/auth/components/SocialLoginButtons";
import type { AuthProvider } from "@/features/auth/types";
import {
  loginSchema,
  type LoginInput,
} from "@/lib/validators/auth.schema";

import { toast } from "sonner";

export interface LoginFormProps {
  showForgotPassword?: boolean;
  className?: string;
  /** Enabled provider strings from GET /auth/providers (e.g. ["local","google","facebook"]) */
  enabledProviders?: AuthProvider[];
}

function LoginForm({
  showForgotPassword = true,
  className,
  enabledProviders,
}: LoginFormProps) {
  const router = useRouter();

  const {
    control,
    handleSubmit,
    formState: { isSubmitting, errors, isDirty },
    setError,
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
    mode: "onTouched",
    reValidateMode: "onChange",
  });

  const [socialLoading, setSocialLoading] = React.useState<
    "facebook" | "google" | null
  >(null);

  // ------------------------------------------------------------------
  // Social login — full-page OAuth redirect (no redirect:false needed)
  // ------------------------------------------------------------------
  async function handleSocial(provider: "facebook" | "google") {
    setSocialLoading(provider);
    toast.info(`Connecting to ${provider.charAt(0).toUpperCase() + provider.slice(1)}...`);
    try {
      await signIn(provider); // Auth.js handles the redirect automatically
    } catch {
      // signIn() with OAuth redirects away; an error here is unexpected.
      toast.error(`Failed to connect to ${provider}. Please try again.`);
      setSocialLoading(null);
    }
  }

  // ------------------------------------------------------------------
  // Credentials login — redirect:false so we can handle errors in-page
  // ------------------------------------------------------------------
  const submitFn: SubmitHandler<LoginInput> = async ({ email, password }) => {
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      // Map Auth.js error codes to a user-friendly message shown on the
      // email field (the identity field — consistent with AppInput's pattern).
      setError("email", {
        type: "manual",
        message: "Invalid email or password. Please try again.",
      });
      toast.error("Invalid email or password. Please try again.");
      return;
    }

    toast.success("Signed in successfully! Redirecting...");
    router.push("/dashboard");
    router.refresh();
  };

  // Show social buttons only when the backend says local login is not the
  // only option AND at least one social provider is enabled.
  const showSocialSection =
    !enabledProviders ||
    enabledProviders.includes("google") ||
    enabledProviders.includes("facebook");

  return (
    <div className={className}>
      {/* 1. Social Login Buttons at top (hidden when no social providers enabled) */}
      {showSocialSection && (
        <SocialLoginButtons
          onFacebookClick={() => handleSocial("facebook")}
          onGoogleClick={() => handleSocial("google")}
          facebookLoading={socialLoading === "facebook"}
          googleLoading={socialLoading === "google"}
          enabledProviders={enabledProviders}
        />
      )}

      {/* 2. Divider (only when both credential and social sections are shown) */}
      {showSocialSection && (
        <div className="my-5">
          <AuthDivider />
        </div>
      )}

      {/* 3. Credentials Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit(submitFn)(e);
        }}
        className="flex flex-col gap-4"
        noValidate
      >
        <Controller
          name="email"
          control={control}
          render={({ field }) => (
            <AppInput
              {...field}
              label="Email"
              type="email"
              placeholder="m@example.com"
              autoComplete="email"
              required
              error={errors.email?.message}
              success={isDirty && !errors.email && field.value.length > 0}
            />
          )}
        />

        <div className="flex flex-col gap-1.5">
          <Controller
            name="password"
            control={control}
            render={({ field }) => (
              <AppInput
                {...field}
                label="Password"
                type="password"
                placeholder="Enter your password"
                autoComplete="current-password"
                required
                error={errors.password?.message}
                success={
                  isDirty && !errors.password && field.value.length > 0
                }
              />
            )}
          />
          {showForgotPassword && (
            <div className="flex justify-end pt-0.5">
              <Link
                href="/forgot-password"
                className="text-xs font-medium text-primary hover:underline underline-offset-4"
              >
                Forgot password?
              </Link>
            </div>
          )}
        </div>

        <AppButton
          type="submit"
          size="lg"
          className="h-10 w-full mt-1 font-semibold shadow-md hover:shadow-lg transition-all"
          isLoading={isSubmitting}
        >
          Sign in
        </AppButton>
      </form>
    </div>
  );
}

export { LoginForm };
