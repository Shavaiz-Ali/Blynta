"use client";
import { Checkbox } from "@base-ui/react/checkbox";
import { Check } from "lucide-react";
import { cn } from "../lib/utils";
export function AppCheckbox({
  label,
  className,
  ...props
}: Checkbox.Root.Props & { label: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <Checkbox.Root
        {...props}
        className={cn(
          "flex size-4 shrink-0 items-center justify-center rounded border border-input bg-background outline-none data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring data-disabled:opacity-50",
          className,
        )}
      >
        <Checkbox.Indicator>
          <Check className="size-3" />
        </Checkbox.Indicator>
      </Checkbox.Root>
      {label}
    </label>
  );
}
