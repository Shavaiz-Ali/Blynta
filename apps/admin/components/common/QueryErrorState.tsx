import { AppQueryState } from "@blynta/ui";
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
    <AppQueryState
      title={title}
      description={description}
      onRetry={onRetry}
      retrying={retrying}
    />
  );
}
