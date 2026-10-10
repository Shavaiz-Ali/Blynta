"use client";
import { useId } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import type { AvailableEditingModels } from "./models";
export function modelSelectionError(
  data: AvailableEditingModels | undefined,
  selected: string,
) {
  if (!data) return "Model availability could not be verified.";
  if (selected !== "auto") {
    if (!data.selectionAllowed)
      return "Your current plan uses Auto. Choose Auto to continue.";
    if (!data.models.some((m) => m.id === selected && m.selectable))
      return "Your selected model is unavailable. Choose another model or Auto.";
  } else if (!data.defaultModelId && !data.compatibilityMode)
    return "No default model is available. An administrator must configure one.";
  return undefined;
}
export function ModelSelector({
  data,
  loading,
  error,
  selected,
  onChange,
  disabled = false,
}: {
  data?: AvailableEditingModels;
  loading: boolean;
  error?: boolean;
  selected: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  const id = useId();
  if (loading)
    return (
      <div aria-label="Loading models">
        <Skeleton className="h-10 w-56" />
      </div>
    );
  if (error)
    return (
      <p role="alert" className="text-sm text-destructive">
        Model availability is temporarily unavailable.
      </p>
    );
  const invalid = modelSelectionError(data, selected);
  const chosen = data?.models.find(
    (m) => m.id === (selected === "auto" ? data.defaultModelId : selected),
  );
  return (
    <div className="min-w-0 space-y-1.5">
      {data?.selectionAllowed ? (
        <>
          <label htmlFor={id} className="text-xs font-medium">
            AI model
          </label>
          <select
            id={id}
            value={selected}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <option value="auto">Auto (Recommended)</option>
            {selected !== "auto" &&
              !data.models.some((m) => m.id === selected && m.selectable) && (
                <option value={selected} disabled>
                  Selected model unavailable
                </option>
              )}
            {data.models
              .filter((m) => m.selectable)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.displayName} · {m.provider}
                </option>
              ))}
          </select>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">
          AI model: {chosen?.displayName ?? "Auto"}
        </p>
      )}
      {data && !data.selectionAllowed && selected !== "auto" && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange("auto")}
          className="text-xs font-medium text-primary underline focus-visible:ring-2 focus-visible:ring-primary"
        >
          Use Auto for your current plan
        </button>
      )}
      {chosen?.description && (
        <p className="text-xs text-muted-foreground">{chosen.description}</p>
      )}
      {data?.compatibilityMode && (
        <p className="text-xs text-muted-foreground">
          Auto uses the existing generation configuration.
        </p>
      )}
      {invalid && (
        <p role="alert" className="text-xs text-destructive">
          {invalid}
        </p>
      )}
    </div>
  );
}
