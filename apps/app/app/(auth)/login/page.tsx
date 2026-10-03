import { redirect } from "next/navigation";
import LegacyLogin from "@/features/legacy-login";
import { safeReturnTo } from "@blynta/auth/server";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const p = await searchParams;
  if (process.env.CENTRAL_AUTH_ENABLED === "true")
    redirect(
      "/auth/start?returnTo=" +
        encodeURIComponent(
          safeReturnTo(p.callbackUrl || p.returnTo, "/dashboard"),
        ),
    );
  return <LegacyLogin />;
}
