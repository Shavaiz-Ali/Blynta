"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Eye, EyeOff, Check } from "lucide-react";

export type AppInputSize = "sm" | "default" | "lg";

export interface AppInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  success?: boolean;
  size?: AppInputSize;
  labelClassName?: string;
  wrapperClassName?: string;
  prefixIcon?: React.ReactNode;
}

const sizeClasses: Record<AppInputSize, string> = {
  sm: "h-8 text-xs px-2.5 rounded-md",
  default: "h-9 text-sm px-3 rounded-md",
  lg: "h-10 text-sm px-3.5 rounded-md",
};

const AppInput = React.forwardRef<HTMLInputElement, AppInputProps>(
  (
    {
      label,
      error,
      helperText,
      required,
      success,
      size = "default",
      labelClassName,
      wrapperClassName,
      className,
      id: idProp,
      type = "text",
      prefixIcon,
      ...props
    },
    ref
  ) => {
    const autoId = React.useId();
    const inputId = idProp ?? autoId;
    const errorId = `${inputId}-error`;
    const helperId = `${inputId}-helper`;

    const [showPassword, setShowPassword] = React.useState(false);
    const isPassword = type === "password";
    const inputType = isPassword ? (showPassword ? "text" : "password") : type;

    const hasRightAdornment = isPassword || success;
    const hasLeftAdornment = !!prefixIcon;

    return (
      <div className={cn("flex w-full flex-col gap-1.5", wrapperClassName)}>
        {label ? (
          <Label
            htmlFor={inputId}
            className={cn(
              "text-xs font-medium text-foreground",
              error && "text-destructive",
              labelClassName
            )}
          >
            {label}
            {required ? (
              <span className="text-destructive ml-0.5">*</span>
            ) : null}
          </Label>
        ) : null}
        <div className="relative flex items-center w-full">
          {/* Left prefix icon */}
          {hasLeftAdornment && (
            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 flex items-center text-muted-foreground">
              {prefixIcon}
            </span>
          )}

          <Input
            id={inputId}
            ref={ref}
            type={inputType}
            aria-invalid={!!error}
            aria-describedby={error ? errorId : helperText ? helperId : undefined}
            className={cn(
              "transition-colors border-input bg-background/50 dark:bg-muted/30 focus-visible:ring-1 focus-visible:ring-ring focus-visible:border-ring text-foreground placeholder:text-muted-foreground/60 shadow-xs",
              sizeClasses[size],
              hasLeftAdornment && (size === "sm" ? "pl-8" : "pl-9"),
              hasRightAdornment && "pr-9",
              error &&
                "border-destructive focus-visible:ring-destructive focus-visible:border-destructive",
              success &&
                !error &&
                "border-emerald-500/80 focus-visible:ring-emerald-500 focus-visible:border-emerald-500",
              className
            )}
            {...props}
          />

          {/* Password Show / Hide Eye Button */}
          {isPassword && (
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-2.5 text-muted-foreground hover:text-foreground focus:outline-none transition-colors p-1 rounded-md"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          )}

          {/* Success Checkmark */}
          {success && !isPassword && (
            <Check className="pointer-events-none absolute right-2.5 h-4 w-4 text-emerald-500 stroke-[2.5]" />
          )}
        </div>
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
);
AppInput.displayName = "AppInput";

export { AppInput };
