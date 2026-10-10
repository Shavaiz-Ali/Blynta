"use client";
import { AppSelect, AppButton, AppSpinner } from "@blynta/ui";
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
  if (loading)
    return (
      <div
        role="status"
        className="flex min-h-9 items-center gap-2 text-xs text-muted-foreground"
      >
        <AppSpinner size="xs" /> Checking model availability…
      </div>
    );
  if (error)
    return (
      <p
        role="status"
        className="max-w-sm text-xs leading-5 text-muted-foreground"
      >
        Model settings couldn’t be loaded. Try again when the service is
        available.
      </p>
    );
  const invalid = modelSelectionError(data, selected);
  const chosen = data?.models.find(
    (m) => m.id === (selected === "auto" ? data.defaultModelId : selected),
  );
  const eligible = data?.models.filter((m) => m.selectable) ?? [];
  return (
    <div className="min-w-0 space-y-1.5">
      {data?.selectionAllowed ? (
        <AppSelect
          aria-label="AI model"
          size="sm"
          value={selected}
          onValueChange={onChange}
          disabled={disabled}
          wrapperClassName="min-w-0 w-full sm:w-64"
          options={[
            {
              value: "auto",
              label: "Auto (Recommended)",
              description: "Automatic model routing",
            },
            ...(selected !== "auto" && !eligible.some((m) => m.id === selected)
              ? [
                  {
                    value: selected,
                    label: "Selected model unavailable",
                    disabled: true,
                  },
                ]
              : []),
            ...eligible.map((m) => ({
              value: m.id,
              label: m.displayName,
              description:
                m.provider + (m.description ? " · " + m.description : ""),
            })),
          ]}
        />
      ) : (
        <p className="flex min-h-8 items-center gap-2 text-xs text-muted-foreground">
          <span className="size-1.5 shrink-0 rounded-full bg-primary" /> AI
          model: {chosen?.displayName ?? "Auto"} · Automatic routing
        </p>
      )}
      {data && !data.selectionAllowed && selected !== "auto" && (
        <AppButton
          type="button"
          variant="link"
          size="sm"
          disabled={disabled}
          onClick={() => onChange("auto")}
        >
          Use Auto for your current plan
        </AppButton>
      )}
      {invalid && (
        <p role="alert" className="max-w-sm text-xs leading-5 text-destructive">
          {invalid}
        </p>
      )}
    </div>
  );
}
