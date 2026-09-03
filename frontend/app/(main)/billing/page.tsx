import { Suspense } from "react";
import { BillingPage } from "@/features/billing/components/BillingPage";

export default function BillingRoute() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-muted-foreground">Loading billing...</div>}>
      <BillingPage />
    </Suspense>
  );
}

