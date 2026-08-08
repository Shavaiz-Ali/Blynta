import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard, LoginForm, getEnabledProviders } from "@/features/auth";

export const metadata: Metadata = {
  title: "Sign In | Blynta",
  description: "Sign in to your Blynta account to continue creating viral video clips.",
};

export default async function LoginPage() {
  const enabledProviders = await getEnabledProviders();

  return (
    <AuthCard
      header={
        <>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Welcome back
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter your credentials below to sign in
          </p>
        </>
      }
      footer={
        <p className="text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link
            href="/signup"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Sign up
          </Link>
        </p>
      }
    >
      <LoginForm enabledProviders={enabledProviders} />
    </AuthCard>
  );
}
