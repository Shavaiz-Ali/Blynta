"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { AppButton } from "@blynta/ui";
import { AppInput } from "@blynta/ui";
import { AppCard } from "@blynta/ui";
import { StudioLogo } from "@/components/common/StudioLogo";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import {
  emailSchema,
  passwordSchema,
  nameSchema,
} from "@/lib/validators/auth.schema";
import { useAccountMutation, useEnabledProviders } from "../queries";

type Mode = "login" | "signup" | "forgot-password" | "reset-password";
const copy = {
  login: [
    "Welcome back",
    "One Blynta account. A whole new workspace.",
    "Sign in",
  ],
  signup: [
    "Create a Blynta account",
    "Use the same account across Blynta and Studio.",
    "Create account",
  ],
  "forgot-password": [
    "Forgot your password?",
    "We’ll help you get back to creating.",
    "Send reset link",
  ],
  "reset-password": [
    "A fresh start",
    "Choose a new password for your Blynta account.",
    "Reset password",
  ],
};
function Form({ mode }: { mode: Mode }) {
  const router = useRouter();
  const params = useSearchParams();
  const [success, setSuccess] = useState(false);
  const [verification, setVerification] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const action = useAccountMutation(mode);
  const verify = useAccountMutation("verify-otp");
  const resend = useAccountMutation("resend-otp");
  const providers = useEnabledProviders();
  const creating = mode === "signup" || mode === "reset-password";
  const schema = z
    .object({
      name: mode === "signup" ? nameSchema : z.string(),
      email: mode === "reset-password" ? z.string() : emailSchema,
      password: creating
        ? passwordSchema
        : mode === "login"
          ? z.string().min(1, "Enter your password")
          : z.string(),
      confirm: z.string(),
      otp: z.string(),
    })
    .refine((v) => !creating || v.password === v.confirm, {
      path: ["confirm"],
      message: "Passwords don’t match",
    });
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", password: "", confirm: "", otp: "" },
    mode: "onTouched",
  });
  const destination = params.get("callbackUrl");
  const next =
    destination?.startsWith("/") &&
    !destination.startsWith("//") &&
    !/[\\\u0000-\u001f]/.test(destination)
      ? destination
      : "/dashboard";
  async function login(email: string, password: string) {
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    if (result?.error)
      throw new Error(
        "Unable to sign in. Check your email and password, verify your account, and try again.",
      );
    router.replace(next);
    router.refresh();
  }
  async function submit(values: z.infer<typeof schema>) {
    setBusy(true);
    setError("");
    try {
      if (mode === "login") await login(values.email, values.password);
      else if (mode === "signup") {
        await action.mutateAsync({
          name: values.name,
          email: values.email,
          password: values.password,
        });
        setVerification(true);
      } else if (mode === "forgot-password") {
        await action.mutateAsync({ email: values.email });
        setSuccess(true);
      } else {
        await action.mutateAsync({
          token: params.get("token") || "",
          newPassword: values.password,
        });
        setSuccess(true);
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Something went wrong. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function verifyEmail(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await verify.mutateAsync({
        email: getValues("email"),
        otp: getValues("otp"),
      });
      await login(getValues("email"), getValues("password"));
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Invalid or expired code. Request another code.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (success)
    return (
      <div className="space-y-5" role="status">
        <CheckCircle2 size={36} className="text-primary" />
        <h1 className="text-2xl font-semibold">
          {mode === "forgot-password" ? "Check your inbox" : "Password updated"}
        </h1>
        <p className="text-muted-foreground">
          {mode === "forgot-password"
            ? "If an account exists for this email, we’ve sent password reset instructions."
            : "Your new password works across Blynta and Studio."}
        </p>
        <Link
          className="text-primary inline-flex items-center gap-2"
          href="/login"
        >
          Return to login <ArrowRight size={16} />
        </Link>
      </div>
    );
  if (mode === "reset-password" && !params.get("token"))
    return (
      <div className="space-y-5">
        <h1 className="text-2xl font-semibold">
          This reset link is incomplete
        </h1>
        <p className="text-muted-foreground">
          Open the full link from your email or request a new one.
        </p>
        <Link className="text-primary" href="/forgot-password">
          Send a new reset link
        </Link>
      </div>
    );
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {verification ? "Verify your email" : copy[mode][0]}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {verification
            ? `Enter the 6-digit code sent to ${getValues("email")}.`
            : copy[mode][1]}
        </p>
      </div>
      {(error || params.get("error")) && (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
        >
          {error ||
            "Sign in could not be completed. Try again or use your email and password."}
        </p>
      )}
      {verification ? (
        <form onSubmit={verifyEmail} className="space-y-4">
          <AppInput
            label="Verification code"
            {...register("otp")}
            required
            pattern="[0-9]{6}"
            maxLength={6}
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
          />
          <AppButton type="submit" className="w-full" isLoading={busy}>
            Verify and continue
          </AppButton>
          <AppButton
            variant="ghost"
            className="w-full"
            isLoading={resend.isPending}
            onClick={async () => {
              try {
                await resend.mutateAsync({ email: getValues("email") });
                setError("");
              } catch {
                setError("Couldn’t resend the code. Try again.");
              }
            }}
          >
            Resend code
          </AppButton>
        </form>
      ) : (
        <>
          {(mode === "login" || mode === "signup") &&
            providers.data
              ?.filter((p) => p === "google" || p === "facebook")
              .map((p) => (
                <AppButton
                  className="w-full"
                  key={p}
                  variant="social"
                  socialProvider={p as "google" | "facebook"}
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await signIn(p, { redirectTo: next });
                    } catch {
                      setError("Couldn’t connect. Try again.");
                      setBusy(false);
                    }
                  }}
                >
                  Continue with {p === "google" ? "Google" : "Facebook"}
                </AppButton>
              ))}
          <form
            onSubmit={handleSubmit(submit)}
            noValidate
            className="space-y-4"
          >
            {mode === "signup" && (
              <AppInput
                label="Full name"
                {...register("name")}
                autoComplete="name"
                autoFocus
                error={errors.name?.message}
              />
            )}
            {mode !== "reset-password" && (
              <AppInput
                label="Email address"
                {...register("email")}
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                error={errors.email?.message}
              />
            )}
            {mode !== "forgot-password" && (
              <AppInput
                label={mode === "reset-password" ? "New password" : "Password"}
                {...register("password")}
                type="password"
                autoComplete={creating ? "new-password" : "current-password"}
                error={errors.password?.message}
                helperText={
                  creating
                    ? "At least 8 characters, including a letter and a number."
                    : undefined
                }
              />
            )}
            {creating && (
              <AppInput
                label="Confirm password"
                {...register("confirm")}
                type="password"
                autoComplete="new-password"
                error={errors.confirm?.message}
              />
            )}
            {mode === "login" && (
              <div className="text-right text-xs">
                <Link
                  className="text-primary hover:underline"
                  href="/forgot-password"
                >
                  Forgot password?
                </Link>
              </div>
            )}
            <AppButton
              type="submit"
              className="w-full"
              isLoading={busy}
              icon={<ArrowRight size={16} />}
              iconPosition="right"
            >
              {copy[mode][2]}
            </AppButton>
          </form>
          <p className="text-center text-sm text-muted-foreground">
            {mode === "login" ? (
              <>
                New to Blynta?{" "}
                <Link className="text-primary hover:underline" href="/signup">
                  Create an account
                </Link>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <Link className="text-primary hover:underline" href="/login">
                  Sign in
                </Link>
              </>
            )}
          </p>
        </>
      )}
    </div>
  );
}
export function AuthPage({ mode }: { mode: Mode }) {
  return (
    <main className="auth-layout">
      <header className="flex items-center justify-between p-5 sm:px-8">
        <StudioLogo />
        <ThemeToggle />
      </header>
      <div className="auth-content">
        <AppCard className="w-full max-w-[420px]">
          <div className="p-6 sm:p-8">
            <Suspense fallback={<LoadingSkeleton />}>
              <Form mode={mode} />
            </Suspense>
          </div>
        </AppCard>
        <p className="mt-6 text-xs text-muted-foreground text-center">
          One account for Blynta and Studio.
        </p>
      </div>
    </main>
  );
}
