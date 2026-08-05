"use client";

import {
  useForm,
  Controller,
  type SubmitHandler,
  type FieldValues,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AppInput } from "@/components/common/AppInput";
import { AppButton } from "@/components/common/AppButton";
import {
  registerSchema,
  type RegisterInput,
} from "@/lib/validators/auth.schema";

export type { RegisterInput as SignupFormValues };

export interface SignupFormProps {
  onSubmit?: SubmitHandler<RegisterInput>;
  isSubmitting?: boolean;
  className?: string;
}

function SignupForm({
  onSubmit,
  isSubmitting = false,
  className,
}: SignupFormProps) {
  const {
    control,
    handleSubmit,
    formState: { isSubmitting: rhfSubmitting, errors, isDirty },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
    mode: "onTouched",
    reValidateMode: "onChange",
  });

  const showLoading = isSubmitting || rhfSubmitting;

  const submitFn: SubmitHandler<RegisterInput> = (values, event) => {
    if (onSubmit) return onSubmit(values, event as never);
    console.log("signup submit", values);
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit(submitFn as SubmitHandler<FieldValues>)(e);
      }}
      className={`flex flex-col gap-4${className ? ` ${className}` : ""}`}
      noValidate
    >
      <Controller
        name="name"
        control={control}
        render={({ field }) => (
          <AppInput
            {...field}
            label="Name"
            type="text"
            placeholder="Jane Doe"
            autoComplete="name"
            required
            error={errors.name?.message}
            success={isDirty && !errors.name && field.value.length > 0}
          />
        )}
      />

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

      <Controller
        name="password"
        control={control}
        render={({ field }) => (
          <AppInput
            {...field}
            label="Password"
            type="password"
            placeholder="Min 8 chars, letters + numbers"
            autoComplete="new-password"
            required
            error={errors.password?.message}
            success={isDirty && !errors.password && field.value.length > 0}
          />
        )}
      />

      <div className="mt-2">
        <AppButton
          type="submit"
          size="lg"
          className="h-10 w-full font-semibold shadow-md hover:shadow-lg transition-all"
          isLoading={showLoading}
        >
          Create account
        </AppButton>
      </div>
    </form>
  );
}

export { SignupForm };
