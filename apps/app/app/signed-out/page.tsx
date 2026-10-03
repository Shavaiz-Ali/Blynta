import Link from "next/link";
import { configuredUrl } from "@blynta/auth/server";
export const dynamic = "force-dynamic";
export default function SignedOut() {
  return (
    <main className="mx-auto max-w-lg space-y-4 p-8">
      <h1 className="text-2xl font-semibold">Signed out of Blynta App</h1>
      <p>
        Your Studio and Admin sessions are unchanged. Central sign-in is still
        available.
      </p>
      <p>
        <Link href="/login">Sign in again</Link>
      </p>
      <p>
        <a href={new URL("/logout", configuredUrl("AUTH_APP_URL")).href}>
          Sign out of all consumer apps
        </a>
      </p>
    </main>
  );
}
