"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

export interface OtpInputProps {
  value?: string;
  onChange?: (value: string) => void;
  onComplete?: (value: string) => void;
  label?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  disabled?: boolean;
  length?: number;
  labelClassName?: string;
  wrapperClassName?: string;
  containerClassName?: string;
  id?: string;
}

function OtpInput({
  value,
  onChange,
  onComplete,
  label,
  error,
  helperText,
  required,
  disabled,
  length = 6,
  labelClassName,
  wrapperClassName,
  containerClassName,
  id: idProp,
}: OtpInputProps) {
  const autoId = React.useId();
  const inputId = idProp || autoId;

  return (
    <div className={cn("flex w-full flex-col gap-1.5", wrapperClassName)}>
      {label && (
        <Label
          htmlFor={inputId}
          className={cn(
            "text-sm font-medium leading-none",
            error && "text-destructive",
            labelClassName
          )}
        >
          {label}
          {required && <span className="text-destructive ml-0.5">*</span>}
        </Label>
      )}
      <div className={cn("flex w-full justify-center", containerClassName)}>
        <InputOTP
          id={inputId}
          maxLength={length}
          value={value}
          onChange={(val) => {
            onChange?.(val);
            if (val.length === length) {
              onComplete?.(val);
            }
          }}
          disabled={disabled}
          containerClassName={cn("gap-2 sm:gap-3")}
        >
          <InputOTPGroup className="gap-2">
            {Array.from({ length }).map((_, i) => (
              <InputOTPSlot
                key={i}
                index={i}
                className={cn(
                  "h-11 w-11 sm:h-12 sm:w-12 text-lg font-semibold rounded-lg border transition-colors",
                  error &&
                    "border-destructive focus-visible:ring-destructive/50"
                )}
              />
            ))}
          </InputOTPGroup>
        </InputOTP>
      </div>
      {error && (
        <p
          className="text-xs font-medium text-destructive text-center"
          role="alert"
        >
          {error}
        </p>
      )}
      {!error && helperText && (
        <p className="text-xs text-muted-foreground text-center">{helperText}</p>
      )}
    </div>
  );
}

export { OtpInput };
