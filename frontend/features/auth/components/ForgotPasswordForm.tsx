"use client";

import {
  useForm,
  Controller,
  type SubmitHandler,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AppInput } from "@/components/common/AppInput";
import { AppButton } from "@/components/common/AppButton";
import {
  forgotPasswordSchema,
  type ForgotPasswordInput,
} from "@/lib/validators/auth.schema";

export interface ForgotPasswordFormProps {
  onSubmit?: SubmitHandler<ForgotPasswordInput>;
  isSubmitting?: boolean;
  className?: string;
}

function ForgotPasswordForm({
  onSubmit,
  isSubmitting = false,
  className,
}: ForgotPasswordFormProps) {
  const {
    control,
    handleSubmit,
    formState: { isSubmitting: rhfSubmitting, errors, isDirty },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
    mode: "onTouched",
    reValidateMode: "onChange",
  });

  const showLoading = isSubmitting || rhfSubmitting;

  const submitFn: SubmitHandler<ForgotPasswordInput> = (values, event) => {
    if (onSubmit) return onSubmit(values, event);
    console.log("forgot password submit", values);
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit(submitFn)(e);
      }}
      className={`flex flex-col gap-5${className ? ` ${className}` : ""}`}
      noValidate
    >
      <Controller
        name="email"
        control={control}
        render={({ field }) => (
          <AppInput
            {...field}
            label="Email"
            type="email"
            placeholder="m@example.com"
            autoComplete="email"
            required
            error={errors.email?.message}
            success={isDirty && !errors.email && field.value.length > 0}
          />
        )}
      />
      <AppButton
        type="submit"
        size="lg"
        className="h-10 w-full font-semibold shadow-md hover:shadow-lg transition-all"
        isLoading={showLoading}
      >
        Send reset link
      </AppButton>
    </form>
  );
}

export { ForgotPasswordForm };
