import { AuthRecovery } from "@blynta/ui";
import { productRestart } from "@/lib/authorization";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const retry = productRestart(params.client);
  if (
    typeof params.transaction === "string" &&
    /^[A-Za-z0-9_-]{43}$/.test(params.transaction)
  )
    retry.searchParams.set("restart", params.transaction);
  return (
    <AuthRecovery
      retryHref={retry.href}
      unavailable={params.reason === "service_unavailable"}
    />
  );
}
