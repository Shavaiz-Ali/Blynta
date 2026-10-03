"use client";

import * as React from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useForm, Controller, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AppInput } from "@blynta/ui";
import { AppButton } from "@blynta/ui";
import { AuthDivider } from "@/features/auth/components/AuthDivider";
import { SocialLoginButtons } from "@/features/auth/components/SocialLoginButtons";
import { useEnabledProviders } from "@/features/auth/queries";
import type { AuthProvider } from "@/features/auth/types";
import { loginSchema, type LoginInput } from "@/lib/validators/auth.schema";

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
  const { data: fetchedProviders, isLoading: providersLoading } =
    useEnabledProviders({
      initialData: enabledProviders,
    });

  const {
    control,
    handleSubmit,
    formState: { isSubmitting, errors, isDirty },
    setError,
    clearErrors,
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
    toast.info(
      `Connecting to ${provider.charAt(0).toUpperCase() + provider.slice(1)}...`,
    );
    try {
      await signIn(provider, { redirectTo: "/continue" }); // Auth.js handles the redirect automatically
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
    clearErrors("root.server");
    let result;
    try {
      result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
    } catch {
      const message = "Unable to reach the sign-in service. Please try again.";
      setError("root.server", { type: "server", message });
      toast.error(message);
      return;
    }
    if (!result || result.error) {
      const invalidCredentials =
        result?.error === "CredentialsSignin" &&
        (!result.code ||
          ["credentials", "invalid_credentials"].includes(result.code));
      const message = invalidCredentials
        ? "Invalid email or password. Please try again."
        : result?.code === "rate_limited"
          ? "Too many sign-in attempts. Wait a minute and try again."
          : "Sign-in is temporarily unavailable. Please try again later.";
      setError(invalidCredentials ? "email" : "root.server", {
        type: "server",
        message,
      });
      toast.error(message);
      return;
    }

    toast.success("Signed in successfully! Redirecting...");
    window.location.assign("/continue");
  };

  const activeProviders = fetchedProviders ??
    enabledProviders ?? ["google", "facebook"];
  const showSocialSection =
    providersLoading ||
    activeProviders.includes("google") ||
    activeProviders.includes("facebook");

  return (
    <div className={className}>
      {/* 1. Social Login Buttons at top (hidden when no social providers enabled) */}
      {showSocialSection && (
        <SocialLoginButtons
          onFacebookClick={() => handleSocial("facebook")}
          onGoogleClick={() => handleSocial("google")}
          facebookLoading={socialLoading === "facebook"}
          googleLoading={socialLoading === "google"}
          initialProviders={enabledProviders}
          isLoading={providersLoading && !enabledProviders}
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
                success={isDirty && !errors.password && field.value.length > 0}
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

        {errors.root?.server?.message && (
          <p role="alert" className="text-sm text-destructive">
            {errors.root.server.message}
          </p>
        )}

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
