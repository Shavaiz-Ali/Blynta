export function InsufficientCredits({
  required,
  available,
  billingUrl,
}: {
  required: number;
  available: number;
  billingUrl?: string;
}) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm"
    >
      <p className="font-semibold">More credits needed</p>
      <p className="mt-1 text-muted-foreground">
        This operation needs {required} credits. You have {available} available.
        Credits held for ongoing work cannot be spent again.
      </p>
      {billingUrl ? (
        <a
          href={billingUrl}
          className="mt-2 inline-block font-semibold underline underline-offset-4"
        >
          View plans and manage billing
        </a>
      ) : (
        <p className="mt-2">
          Open Billing & Plan in the main Blynta app to manage credits.
        </p>
      )}
    </div>
  );
}
