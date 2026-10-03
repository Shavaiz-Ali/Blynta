import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard, LoginForm } from "@/features/auth";
import { auth } from "@/auth";
import { configuredUrl } from "@blynta/auth/server";

export const metadata: Metadata = {
  title: "Sign In | Blynta",
  description:
    "Sign in to your Blynta account to continue creating viral video clips.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const product =
    params.from === "main" || params.from === "studio" ? params.from : null;
  const logoutMode = params.mode === "product-logout" && product !== null;
  const landing = logoutMode
    ? `/login?mode=product-logout&from=${product}`
    : "/continue";
  const session = logoutMode ? await auth() : null;
  if (session?.user && params.account !== "other") {
    const label = product === "studio" ? "Studio" : "Blynta App";
    const continuation = new URL(
      "/auth/start",
      configuredUrl(product === "studio" ? "STUDIO_APP_URL" : "MAIN_APP_URL"),
    ).href;
    return (
      <AuthCard
        header={
          <>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Your Blynta account
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose when to return to {label}.
            </p>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          Signed in as{" "}
          <span className="font-medium text-foreground">
            {session.user.email}
          </span>
        </p>
        <a
          href={continuation}
          className="flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Continue to {label}
        </a>
        <Link
          href={`${landing}&account=other`}
          className="block text-center text-sm text-primary hover:underline"
        >
          Use another account
        </Link>
        <Link
          href="/logout"
          className="block text-center text-sm text-muted-foreground hover:underline"
        >
          Sign out of all consumer apps
        </Link>
      </AuthCard>
    );
  }
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
            href={
              logoutMode
                ? `/signup?mode=product-logout&from=${product}`
                : "/signup"
            }
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Sign up
          </Link>
        </p>
      }
    >
      <LoginForm redirectTo={landing} />
    </AuthCard>
  );
}
