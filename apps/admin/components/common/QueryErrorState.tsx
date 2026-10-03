import { AppButton } from "./AppButton";
export function QueryErrorState({
  title = "Unable to load data",
  description = "Check your connection and permissions, then try again.",
  onRetry,
  retrying,
}: {
  title?: string;
  description?: string;
  onRetry: () => void;
  retrying?: boolean;
}) {
  return (
    <div role="alert" className="rounded-lg border p-6">
      <h2 className="font-medium">{title}</h2>
      <p className="my-2 text-sm text-muted-foreground">{description}</p>
      <AppButton variant="outline" onClick={onRetry} isLoading={retrying}>
        Try again
      </AppButton>
    </div>
  );
}
