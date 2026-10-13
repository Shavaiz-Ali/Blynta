"use client";
import { RadioGroup } from "@base-ui/react/radio-group";
import { Radio } from "@base-ui/react/radio";
import { cn } from "../lib/utils";
export function AppRadioGroup({
  options,
  className,
  ...props
}: RadioGroup.Props<string> & {
  options: { value: string; label: React.ReactNode; description?: string }[];
}) {
  return (
    <RadioGroup {...props} className={cn("grid gap-2", className)}>
      {options.map((option) => (
        <label
          key={option.value}
          className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-muted/20 p-3 text-sm has-data-checked:border-primary/50 has-data-checked:bg-primary/5"
        >
          <Radio.Root
            value={option.value}
            className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border border-input outline-none data-checked:border-primary focus-visible:ring-2 focus-visible:ring-ring data-disabled:opacity-50"
          >
            <Radio.Indicator className="size-2 rounded-full bg-primary" />
          </Radio.Root>
          <span>
            <span className="font-medium">{option.label}</span>
            {option.description && (
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                {option.description}
              </span>
            )}
          </span>
        </label>
      ))}
    </RadioGroup>
  );
}
