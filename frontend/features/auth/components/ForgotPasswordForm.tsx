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

import { toast } from "sonner";
import { useForgotPassword } from "../queries";
import { ApiError } from "@/config/axiosClient";

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


  const forgotPasswordMutation = useForgotPassword({
    onSuccess: () => {
      toast.success("Email sent successfully.");
    },
    onError: (error) => {
      const message =
        error instanceof ApiError
          ? error.message
          : (error?.message ?? "Something went wrong. Please try again.");
      toast.error(message);
    },
  });

  const submitFn: SubmitHandler<ForgotPasswordInput> = (values, event) => {
    forgotPasswordMutation.mutate(values);
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
        isLoading={forgotPasswordMutation.isPending}
        disabled={forgotPasswordMutation.isPending}
      >
        Send reset link
      </AppButton>
    </form>
  );
}

export { ForgotPasswordForm };
