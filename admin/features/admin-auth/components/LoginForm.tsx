"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { AppButton } from "@/components/common/AppButton";
import { AppInput } from "@/components/common/AppInput";
import { ShieldCheck, AlertCircle, Lock, Mail } from "lucide-react";
import { toast } from "sonner";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (!res || res.error) {
        setError("Invalid email or password. Admin privileges required.");
        toast.error("Authentication failed. Please check your credentials.");
      } else {
        toast.success("Welcome to Blynta Admin!");
        router.push(callbackUrl);
        router.refresh();
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto min-w-0 w-full max-w-md">
      <div className="space-y-6 rounded-lg border bg-card p-6 text-card-foreground shadow-sm sm:p-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="mx-auto size-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shadow-xs ring-1 ring-primary/20">
            <ShieldCheck className="size-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Admin Portal
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Sign in with your administrative credentials to manage Blynta.
          </p>
        </div>

        {error && (
          <div role="alert" className="flex gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <AppInput
            label="Email Address"
            type="email"
            placeholder="admin@blynta.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
            autoComplete="email"
            prefixIcon={<Mail className="size-4" />}
          />

          <AppInput
            label="Password"
            type="password"
            placeholder="••••••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            prefixIcon={<Lock className="size-4" />}
          />

          <AppButton
            type="submit"
            size="lg"
            className="mt-2 w-full font-semibold"
            isLoading={loading}
          >
            Sign In to Admin
          </AppButton>
        </form>
      </div>
    </div>
  );
}
