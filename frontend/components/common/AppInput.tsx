"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Eye, EyeOff, Check } from "lucide-react";

export interface AppInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  success?: boolean;
  labelClassName?: string;
  wrapperClassName?: string;
}

const AppInput = React.forwardRef<HTMLInputElement, AppInputProps>(
  (
    {
      label,
      error,
      helperText,
      required,
      success,
      labelClassName,
      wrapperClassName,
      className,
      id: idProp,
      type = "text",
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

    return (
      <div className={cn("flex w-full flex-col gap-1.5", wrapperClassName)}>
        {label ? (
          <Label
            htmlFor={inputId}
            className={cn(
              "text-sm font-medium leading-none text-foreground",
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
          <Input
            id={inputId}
            ref={ref}
            type={inputType}
            aria-invalid={!!error}
            aria-describedby={error ? errorId : helperText ? helperId : undefined}
            className={cn(
              "h-10 transition-colors bg-card/60 border-border/80 focus-visible:ring-primary/50 text-foreground placeholder:text-muted-foreground/60",
              isPassword || success ? "pr-10" : "",
              error &&
                "border-destructive focus-visible:ring-destructive/50 focus-visible:border-destructive",
              success &&
                !error &&
                "border-emerald-500/80 focus-visible:ring-emerald-500/50 focus-visible:border-emerald-500",
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
              className="absolute right-3 text-muted-foreground hover:text-foreground focus:outline-none transition-colors p-1 rounded-md"
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
            <Check className="pointer-events-none absolute right-3 h-4 w-4 text-emerald-500 stroke-[2.5]" />
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
