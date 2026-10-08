import { AppLinkButton } from "./AppButton";

export function AuthRecovery({
  retryHref,
  unavailable = false,
}: {
  retryHref: string;
  unavailable?: boolean;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-xl">
        <p className="mb-6 text-xl font-semibold text-primary">Blynta</p>
        <h1 className="text-2xl font-semibold">
          {unavailable
            ? "Sign-in is temporarily unavailable"
            : "Your sign-in session expired"}
        </h1>
        <p className="my-4 text-muted-foreground">
          {unavailable
            ? "We couldn’t reach the sign-in service. Please try again in a moment."
            : "We couldn’t complete that sign-in attempt. Start again to continue."}
        </p>
        <AppLinkButton render={<a href={retryHref} />} className="w-full">
          Try again
        </AppLinkButton>
      </div>
    </main>
  );
}
