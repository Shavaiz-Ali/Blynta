import { Suspense } from "react";
import { BillingPage } from "@/features/billing/components/BillingPage";
import { PaddleProvider } from "@/features/billing/components/PaddleProvider";

export default function BillingRoute() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-muted-foreground">Loading billing...</div>}>
      <PaddleProvider>
        <BillingPage />
      </PaddleProvider>
    </Suspense>
  );
}

