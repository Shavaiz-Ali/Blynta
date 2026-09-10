"use client";

import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type AppSelectSize = "sm" | "default" | "lg";

export interface AppSelectOption {
  value: string;
  label: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
}

export interface AppSelectProps {
  id?: string;
  label?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  options?: AppSelectOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  size?: AppSelectSize;
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
  labelClassName?: string;
  wrapperClassName?: string;
  children?: React.ReactNode;
}

const sizeTriggerClasses: Record<AppSelectSize, string> = {
  sm: "h-8 text-xs px-2.5 rounded-md",
  default: "h-9 text-sm px-3 rounded-md",
  lg: "h-10 text-sm px-3.5 rounded-md",
};

export function AppSelect({
  id: idProp,
  label,
  error,
  helperText,
  required,
  options,
  value,
  defaultValue,
  onValueChange,
  placeholder = "Select an option",
  disabled,
  size = "default",
  className,
  triggerClassName,
  contentClassName,
  labelClassName,
  wrapperClassName,
  children,
}: AppSelectProps) {
  const autoId = React.useId();
  const selectId = idProp ?? autoId;
  const errorId = `${selectId}-error`;
  const helperId = `${selectId}-helper`;

  return (
    <div className={cn("flex w-full flex-col gap-1.5", wrapperClassName)}>
      {label && (
        <Label
          htmlFor={selectId}
          className={cn(
            "text-xs font-medium text-foreground",
            error && "text-destructive",
            labelClassName
          )}
        >
          {label}
          {required && <span className="text-destructive ml-0.5">*</span>}
        </Label>
      )}

      <Select
        value={value}
        defaultValue={defaultValue}
        onValueChange={(val: string | null) => {
          if (val !== null) onValueChange?.(val);
        }}
        disabled={disabled}
      >
        <SelectTrigger
          id={selectId}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : helperId ? helperId : undefined}
          className={cn(
            sizeTriggerClasses[size],
            "border-input bg-background/50 dark:bg-muted/30 focus-visible:ring-1 focus-visible:ring-ring focus-visible:border-ring shadow-xs",
            error && "border-destructive focus-visible:ring-destructive",
            triggerClassName,
            className
          )}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className={cn("rounded-md border-border bg-popover text-popover-foreground shadow-md", contentClassName)}>
          {children
            ? children
            : options?.map((opt) => (
                <SelectItem
                  key={opt.value}
                  value={opt.value}
                  disabled={opt.disabled}
                  className="rounded-sm"
                >
                  <div className="flex flex-col text-left py-0.5">
                    <span className="text-sm font-medium text-foreground">
                      {opt.label}
                    </span>
                    {opt.description && (
                      <span className="text-[11px] text-muted-foreground mt-0.5">
                        {opt.description}
                      </span>
                    )}
                  </div>
                </SelectItem>
              ))}
        </SelectContent>
      </Select>

      {error ? (
        <p id={errorId} className="text-xs font-medium text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {!error && helperText ? (
        <p id={helperId} className="text-xs text-muted-foreground">
          {helperText}
        </p>
      ) : null}
    </div>
  );
}
