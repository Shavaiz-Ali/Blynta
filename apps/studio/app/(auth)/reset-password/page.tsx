import { redirect } from "next/navigation";
import Legacy from "@/features/legacy-reset-password";
import { configuredUrl } from "@blynta/auth/server";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  if (process.env.CENTRAL_AUTH_ENABLED === "true") {
    const url = new URL("/reset-password", configuredUrl("AUTH_APP_URL"));
    if (typeof params.token === "string")
      url.searchParams.set("token", params.token);
    redirect(url.href);
  }
  return <Legacy searchParams={Promise.resolve(params)} />;
}
