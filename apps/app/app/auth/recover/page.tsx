import { AuthRecovery } from "@blynta/ui";
import { safeReturnTo, authorizationReturnTo } from "@blynta/auth/server";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return (
    <AuthRecovery
      retryHref={
        "/auth/start?returnTo=" +
        encodeURIComponent(
          safeReturnTo(
            params.returnTo,
            await authorizationReturnTo("blynta-main", params.transaction),
          ),
        )
      }
    />
  );
}
