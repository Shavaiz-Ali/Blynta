"use client";

import * as React from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface AppTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  labelClassName?: string;
  wrapperClassName?: string;
  showCount?: boolean;
}

const AppTextarea = React.forwardRef<HTMLTextAreaElement, AppTextareaProps>(
  (
    {
      label,
      error,
      helperText,
      required,
      labelClassName,
      wrapperClassName,
      className,
      id: idProp,
      maxLength,
      value,
      showCount = false,
      ...props
    },
    ref
  ) => {
    const autoId = React.useId();
    const inputId = idProp ?? autoId;
    const errorId = `${inputId}-error`;
    const helperId = `${inputId}-helper`;

    const currentLength =
      typeof value === "string" ? value.length : 0;

    return (
      <div className={cn("flex flex-col gap-1.5 w-full", wrapperClassName)}>
        {label && (
          <div className="flex items-center justify-between">
            <Label
              htmlFor={inputId}
              className={cn(
                "text-xs font-medium text-foreground",
                error && "text-destructive",
                labelClassName
              )}
            >
              {label}
              {required && (
                <span className="text-destructive ml-0.5" aria-hidden="true">
                  *
                </span>
              )}
            </Label>

            {showCount && maxLength && (
              <span className="text-[11px] text-muted-foreground">
                {currentLength}/{maxLength}
              </span>
            )}
          </div>
        )}

        <textarea
          ref={ref}
          id={inputId}
          value={value}
          maxLength={maxLength}
          aria-invalid={!!error}
          aria-describedby={
            error ? errorId : helperText ? helperId : undefined
          }
          className={cn(
            "w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-y transition-colors",
            error && "border-destructive focus-visible:ring-destructive",
            className
          )}
          {...props}
        />

        {error && (
          <p id={errorId} className="text-xs text-destructive font-medium">
            {error}
          </p>
        )}

        {helperText && !error && (
          <p id={helperId} className="text-xs text-muted-foreground">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

AppTextarea.displayName = "AppTextarea";

export { AppTextarea };
