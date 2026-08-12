import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AuthCard, ForgotPasswordForm } from "@/features/auth";

export const metadata: Metadata = {
  title: "Reset Password | Blynta",
  description: "Enter your email address to receive a password reset link for your Blynta account.",
};

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      header={
        <>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Reset your password
          </h1>
          <p className="text-sm text-muted-foreground">
            Enter your email below to receive a reset link
          </p>
        </>
      }
      footer={
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to sign in
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
