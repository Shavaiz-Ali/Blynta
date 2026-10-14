import type { Metadata } from "next";
import { Suspense } from "react";
import {
  ResetPasswordFlow,
  ResetPasswordLoading,
} from "@/features/auth/components/ResetPasswordFlow";

export const metadata: Metadata = {
  title: "Reset password - Blynta",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <Suspense fallback={<ResetPasswordLoading />}>
      <ResetPasswordFlow />
    </Suspense>
  );
}
