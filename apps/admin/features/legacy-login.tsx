import { Suspense } from "react";
import { LoginForm } from "@/features/admin-auth";
import { AppSpinner } from "@blynta/ui";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center p-8">
          <AppSpinner size="lg" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
