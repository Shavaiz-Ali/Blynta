import { redirect } from "next/navigation";
import Legacy from "@/features/legacy-signup";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  if (process.env.CENTRAL_AUTH_ENABLED === "true") {
    redirect(
      "/auth/start?screen=signup&returnTo=" +
        encodeURIComponent(
          typeof params.callbackUrl === "string"
            ? params.callbackUrl
            : "/dashboard",
        ) +
        (typeof params.ref === "string"
          ? "&ref=" + encodeURIComponent(params.ref)
          : ""),
    );
  }
  return <Legacy />;
}
