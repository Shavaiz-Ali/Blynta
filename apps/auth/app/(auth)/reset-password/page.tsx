"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppButton, AppInput } from "@blynta/ui";
import { AuthCard } from "@/features/auth";
import { axiosClient } from "@/config/axiosClient";
function ResetForm() {
  const search = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  return (
    <AuthCard header={<h1 className="text-2xl font-bold">Reset password</h1>}>
      <form
        className="flex flex-col gap-4"
        onSubmit={async (event) => {
          event.preventDefault();
          setLoading(true);
          setError("");
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
          onChange={(e) => setPassword(e.target.value)}
          error={error}
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
