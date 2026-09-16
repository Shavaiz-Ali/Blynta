"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import {
  initializePaddle,
  type Paddle,
  type Environments,
  type PaddleEventData,
} from "@paddle/paddle-js";
import { useQueryClient } from "@tanstack/react-query";
import { invalidateCurrentUser } from "@/features/billing/queries";
import { toast } from "sonner";

interface PaddleContextValue {
  paddle: Paddle | undefined;
  isReady: boolean;
  openCheckout: (options: { transactionId: string }) => void;
}

const PaddleContext = React.createContext<PaddleContextValue>({
  paddle: undefined,
  isReady: false,
  openCheckout: () => {},
});

export function usePaddle() {
  return React.useContext(PaddleContext);
}

let paddlePromise: Promise<Paddle | undefined> | null = null;

function getOrInitPaddle(
  token: string,
  environment: Environments,
  eventCallback?: (event: PaddleEventData) => void,
): Promise<Paddle | undefined> {
  if (!paddlePromise) {
    paddlePromise = initializePaddle({
      environment,
      token,
      eventCallback,
    });
  }
  return paddlePromise;
}

export function PaddleProvider({ children }: { children: React.ReactNode }) {
  const [paddle, setPaddle] = React.useState<Paddle | undefined>(undefined);
  const [isReady, setIsReady] = React.useState(false);
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const openedTxnRef = React.useRef<string | null>(null);

  const clientToken = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
  const environment: Environments =
    process.env.NEXT_PUBLIC_PADDLE_ENV === "production" ||
    (clientToken && !clientToken.startsWith("test_"))
      ? "production"
      : "sandbox";

  // Event handler for Paddle checkout events
  const handlePaddleEvent = React.useCallback(
    (event: PaddleEventData) => {
      if (event.name === "checkout.completed") {
        toast.success("Payment completed! Updating your subscription...");
        invalidateCurrentUser(queryClient);

        // Schedule periodic refetches to catch the background webhook sync
        const timers = [1500, 3500, 6000].map((delay) =>
          setTimeout(() => {
            invalidateCurrentUser(queryClient);
          }, delay),
        );

        return () => timers.forEach(clearTimeout);
      }

      if (event.name === "checkout.closed") {
        if (typeof window !== "undefined") {
          const url = new URL(window.location.href);
          if (url.searchParams.has("_ptxn")) {
            url.searchParams.delete("_ptxn");
            window.history.replaceState({}, "", url.toString());
          }
        }
      }
    },
    [queryClient],
  );

  React.useEffect(() => {
    if (typeof window === "undefined" || !clientToken) {
      return;
    }

    let isMounted = true;

    getOrInitPaddle(clientToken, environment, handlePaddleEvent)
      .then((instance) => {
        if (!isMounted) return;
        if (instance) {
          setPaddle(instance);
          setIsReady(true);
        }
      })
      .catch((err) => {
        console.error("[Paddle] Initialization error:", err);
      });

    return () => {
      isMounted = false;
    };
  }, [clientToken, environment, handlePaddleEvent]);

  // Handle _ptxn transaction query parameter from backend
  const ptxn = searchParams?.get("_ptxn");

  React.useEffect(() => {
    if (!paddle || !ptxn) return;

    // Avoid reopening if already opened for this transaction ID
    if (openedTxnRef.current === ptxn) return;
    openedTxnRef.current = ptxn;

    try {
      paddle.Checkout.open({
        transactionId: ptxn,
        settings: {
          displayMode: "overlay",
          theme: "dark",
          successUrl: `${window.location.origin}/billing?success=true`,
        },
      });
    } catch (err) {
      console.error("[Paddle] Failed to open checkout for transaction:", err);
    }
  }, [paddle, ptxn]);

  // Helper to open checkout explicitly
  const openCheckout = React.useCallback(
    (options: { transactionId: string }) => {
      if (!paddle) {
        toast.error(
          "Payment system is still initializing. Please try again in a moment.",
        );
        return;
      }
      paddle.Checkout.open({
        transactionId: options.transactionId,
        settings: {
          displayMode: "overlay",
          theme: "dark",
          successUrl: `${window.location.origin}/billing?success=true`,
        },
      });
    },
    [paddle],
  );

  return (
    <PaddleContext.Provider value={{ paddle, isReady, openCheckout }}>
      {children}
    </PaddleContext.Provider>
  );
}
