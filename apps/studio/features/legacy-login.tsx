import { AuthPage } from "@/features/auth/components/AuthPage";
import { centralAuthUrl } from "@/features/auth/central-auth";
import { redirect } from "next/navigation";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const callback =
    typeof params.returnTo === "string"
      ? params.returnTo
      : typeof params.callbackUrl === "string"
        ? params.callbackUrl
        : undefined;
  const central = centralAuthUrl("/login", callback);
  if (central) {
    const url = new URL(central);
    if (typeof params.token === "string")
      url.searchParams.set("token", params.token);
    redirect(url.href);
  }
  return <AuthPage mode="login" />;
}
