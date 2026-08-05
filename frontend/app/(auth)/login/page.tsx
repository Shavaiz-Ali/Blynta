import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/features/auth/components/AuthCard";
import { LoginForm } from "@/features/auth/components/LoginForm";

export const metadata: Metadata = {
  title: "Sign In | Blynta",
  description: "Sign in to your Blynta account to continue creating viral video clips.",
};

/**
 * Fetches the list of enabled auth providers from the NestJS backend.
 * Done server-side so the UI never flashes hidden/visible buttons and
 * we avoid a client-side waterfall on page load.
 *
 * Falls back to showing all providers if the endpoint is unreachable —
 * better to show a non-functional button than to break the page.
 */
async function getEnabledProviders(): Promise<string[]> {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
  if (!backendUrl) return ["local", "google", "facebook"];

  try {
    const res = await fetch(`${backendUrl}/auth/providers`, {
      // Revalidate every 60 s so provider toggles propagate quickly
      // without a full cold fetch on every page load.
      next: { revalidate: 60 },
    });

    if (!res.ok) return ["local", "google", "facebook"];

    const json = await res.json();

    // Handle both raw array and our standard envelope { success, data }
    if (Array.isArray(json)) return json as string[];
    if (json?.success && Array.isArray(json.data)) return json.data as string[];

    return ["local", "google", "facebook"];
  } catch {
    // Network error / backend down — degrade gracefully
    return ["local", "google", "facebook"];
  }
}

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
