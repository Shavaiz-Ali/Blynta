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
      aria-label="Credit packs"
      className="scroll-mt-6 space-y-3"
    >
      {packs.isPending && (
        <p role="status" className="text-sm text-muted-foreground">
          Loading credit packs…
        </p>
      )}
      {packs.isError && (
        <div role="alert" className="flex flex-wrap items-center gap-2">
          <p className="text-xs text-muted-foreground">
            Credit packs unavailable.
          </p>
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
          const available =
            !packs.isError &&
            pack.enabled &&
            !!price &&
            !pack.configurationError;
          return (
            <AppCardRoot key={pack.id}>
              <AppCardHeader>
                <AppCardTitle>{pack.credits} Credits</AppCardTitle>
                <AppCardDescription>One-time purchase</AppCardDescription>
              </AppCardHeader>
              <AppCardContent className="space-y-3">
                {available ? (
                  <p className="text-xl font-semibold">{price}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">Unavailable</p>
                )}
                <AppButton
                  className="w-full"
                  variant="outline"
                  disabled={!available || busy}
                  aria-label={`Buy ${pack.credits} credits`}
                  isLoading={
                    checkout.isPending && checkout.variables === pack.id
                  }
                  onClick={() => startPurchase(pack.id)}
                >
                  Buy Credits
                </AppButton>
              </AppCardContent>
            </AppCardRoot>
          );
        })}
      </div>
    </section>
  );
}
