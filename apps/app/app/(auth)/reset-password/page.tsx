import { redirect } from "next/navigation";
import { configuredUrl } from "@blynta/auth/server";

/** Preserve the reset link issued by the original backend mail template. */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token } = await searchParams;
  const url = new URL("/reset-password", configuredUrl("AUTH_APP_URL"));
  if (typeof token === "string") url.searchParams.set("token", token);
  redirect(url.href);
}
