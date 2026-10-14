"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppButton, AppInput } from "@blynta/ui";
import { AuthCard } from "@/features/auth";
import { axiosClient } from "@/config/axiosClient";
function ResetForm() {
  const search = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [confirmError, setConfirmError] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  return (
    <AuthCard header={<h1 className="text-2xl font-bold">Reset password</h1>}>
      <form
        className="flex flex-col gap-4"
        onSubmit={async (event) => {
          event.preventDefault();
          setError("");
          setConfirmError("");
          if (password !== confirmPassword) {
            setConfirmError("Passwords do not match.");
            return;
          }
          setLoading(true);
          try {
            await axiosClient.post("/auth/reset-password", {
              token: search.get("token"),
              newPassword: password,
            });
            window.location.assign("/login");
          } catch {
            setError(
              "Invalid or expired reset link. Request a new link and try again.",
            );
          } finally {
            setLoading(false);
          }
        }}
      >
        <AppInput
          label="New password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setConfirmError("");
          }}
          error={error}
        />
        <AppInput
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={confirmPassword}
          onChange={(e) => {
            setConfirmPassword(e.target.value);
            setConfirmError("");
          }}
          error={confirmError}
        />
        <AppButton type="submit" isLoading={loading}>
          Reset password
        </AppButton>
      </form>
    </AuthCard>
  );
}
export default function Page() {
  return (
    <Suspense fallback={null}>
      <ResetForm />
    </Suspense>
  );
}
