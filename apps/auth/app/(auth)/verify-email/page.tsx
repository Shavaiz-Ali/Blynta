"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppButton, AppInput } from "@blynta/ui";
import { AuthCard } from "@/features/auth";
import { useVerifyOtp, useResendOtp } from "@/features/auth/queries";

function VerificationForm() {
  const search = useSearchParams();
  const [email, setEmail] = useState(search.get("email") || "");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const verify = useVerifyOtp({
    onSuccess: () => window.location.assign("/login"),
    onError: () =>
      setError("Invalid or expired code. Request a new code and try again."),
  });
  const resend = useResendOtp({
    onSuccess: () =>
      setNotice("If this account needs verification, a new code was sent."),
    onError: () => setError("Unable to send a code. Please try again later."),
  });
  return (
    <AuthCard
      header={<h1 className="text-2xl font-bold">Verify your email</h1>}
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          setError("");
          verify.mutate({ email, otp });
        }}
      >
        <AppInput
          label="Email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <AppInput
          label="Verification code"
          autoComplete="one-time-code"
          inputMode="numeric"
          pattern="[0-9]{6}"
          required
          value={otp}
          onChange={(event) => setOtp(event.target.value)}
          error={error}
        />
        {notice && <p role="status">{notice}</p>}
        <AppButton type="submit" isLoading={verify.isPending}>
          Verify email
        </AppButton>
        <AppButton
          type="button"
          variant="outline"
          disabled={!email || resend.isPending}
          onClick={() => {
            setError("");
            resend.mutate(email);
          }}
        >
          Resend code
        </AppButton>
      </form>
    </AuthCard>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <VerificationForm />
    </Suspense>
  );
}
