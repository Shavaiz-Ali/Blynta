export function InsufficientCredits({
  required,
  available,
  billingUrl,
  billingLabel = "View plans and manage billing",
}: {
  required: number;
  available: number;
  billingUrl?: string;
  billingLabel?: string;
}) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm"
    >
      <p className="font-semibold">Not enough credits</p>
      <p className="mt-1 text-muted-foreground">
        This operation needs {required} credits. You have {available} available.
        You need {Math.max(0, required - available)} additional credits to
        continue. Credits held for ongoing work cannot be spent again.
      </p>
      {billingUrl ? (
        <div className="flex flex-wrap gap-4">
          <a
            href={billingUrl}
            className="mt-2 inline-block font-semibold underline underline-offset-4"
          >
            {billingLabel}
          </a>
          <a
            href={`${billingUrl.split("#")[0]}#buy-credits`}
            className="mt-2 inline-block font-semibold underline underline-offset-4"
          >
            Buy credits
          </a>
        </div>
      ) : (
        <p className="mt-2">
          Open Billing & Plan in the main Blynta app to manage credits.
        </p>
      )}
    </div>
  );
}
