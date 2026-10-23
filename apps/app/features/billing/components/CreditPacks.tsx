"use client";
import {
  AppButton,
  AppCardRoot,
  AppCardHeader,
  AppCardTitle,
  AppCardDescription,
  AppCardContent,
} from "@blynta/ui";
import { useCreditPacks, useCreditPackCheckout } from "../queries";
import { usePaddle } from "../paddle-context";
import { toast } from "sonner";
import { formatBillingPrice } from "../format";
import { BILLING_CHECKOUT_TOAST_ID } from "../constants";

export const formatCreditPackPrice = (price?: {
  amount: string;
  currencyCode: string;
}) => formatBillingPrice(price, true);

export function CreditPacks() {
  const packs = useCreditPacks();
  const checkout = useCreditPackCheckout();
  const paddle = usePaddle();
  const busy =
    checkout.isPending ||
    paddle.status === "opening" ||
    paddle.status === "confirming";
  const startPurchase = (packId: string) =>
    checkout.mutate(packId, {
      onError: (error) =>
        toast.error(error.message, {
          id: BILLING_CHECKOUT_TOAST_ID,
          action: { label: "Retry", onClick: () => startPurchase(packId) },
        }),
    });
  return (
    <section
      id="buy-credits"
      aria-labelledby="credit-purchases"
      className="scroll-mt-6 space-y-3"
    >
      <h2 id="credit-purchases" className="text-base font-semibold">
        Credit purchases
      </h2>
      <p className="text-sm text-muted-foreground">
        One-time credits without changing your subscription. Tax and your final
        total are confirmed by Paddle before payment.
      </p>
      {packs.isPending && (
        <p role="status" className="text-sm text-muted-foreground">
          Loading credit packs…
        </p>
      )}
      {packs.isError && (
        <div role="alert" className="space-y-2">
          <p className="text-sm text-destructive">{packs.error.message}</p>
          <AppButton
            size="sm"
            variant="outline"
            onClick={() => packs.refetch()}
          >
            Retry loading credit packs
          </AppButton>
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-3">
        {packs.data?.map((pack) => {
          const price = formatCreditPackPrice(pack.price);
          return (
            <AppCardRoot key={pack.id}>
              <AppCardHeader>
                <AppCardTitle>{pack.credits} credits</AppCardTitle>
                <AppCardDescription>One-time credit pack</AppCardDescription>
              </AppCardHeader>
              <AppCardContent className="space-y-3">
                <p className="text-xl font-semibold">
                  {price || "Currently unavailable"}
                </p>
                {pack.configurationError && (
                  <p className="text-xs text-muted-foreground">
                    This credit pack is temporarily unavailable.
                  </p>
                )}
                <AppButton
                  className="w-full"
                  variant="outline"
                  disabled={!pack.enabled || !price || busy}
                  isLoading={
                    checkout.isPending && checkout.variables === pack.id
                  }
                  onClick={() => startPurchase(pack.id)}
                >
                  Buy {pack.credits} credits
                </AppButton>
              </AppCardContent>
            </AppCardRoot>
          );
        })}
      </div>
    </section>
  );
}
