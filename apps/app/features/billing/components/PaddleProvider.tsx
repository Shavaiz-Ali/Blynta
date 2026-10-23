"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import { useQueryClient } from "@tanstack/react-query";
import type { PaddleEventData, Paddle } from "@paddle/paddle-js";
import { toast } from "sonner";
import { axiosClient } from "@/config/axiosClient";
import { invalidateCurrentUser } from "../cache";
import {
  PaddleContext,
  type CheckoutPayload,
  type PaddleCheckoutContext,
  type PaddleEnvironment,
} from "../paddle-context";
import { checkoutEnvironment, createPaddleLoader } from "../paddle-client";
import { BILLING_CHECKOUT_TOAST_ID } from "../constants";
export { usePaddle } from "../paddle-context";

const loadPaddle = createPaddleLoader();
let currentListener: ((event: PaddleEventData) => void) | undefined;
const dispatch = (event: PaddleEventData) => currentListener?.(event);

export function PaddleProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] =
    React.useState<PaddleCheckoutContext["status"]>("loading");
  const [error, setError] = React.useState<string>();
  const queryClient = useQueryClient();
  const params = useSearchParams();
  const { resolvedTheme } = useTheme();
  const instance = React.useRef<Paddle | undefined>(undefined);
  const environment = React.useRef<PaddleEnvironment | undefined>(undefined);
  const transaction = React.useRef<string | null>(null);
  const paymentCompleted = React.useRef(false);
  const opening = React.useRef<{
    resolve: () => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);
  const verificationTimers = React.useRef<ReturnType<typeof setTimeout>[]>([]);
  const resumeAttempted = React.useRef<string | null>(null);
  const retryAction = React.useRef<(() => Promise<void>) | undefined>(
    undefined,
  );

  const clearUrl = React.useCallback(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete("_ptxn");
    url.searchParams.delete("success");
    url.searchParams.delete("canceled");
    window.history.replaceState(null, "", url.toString());
  }, []);

  const fail = React.useCallback((message: string) => {
    setError(message);
    setStatus("error");
    if (opening.current) {
      clearTimeout(opening.current.timer);
      opening.current.reject(new Error(message));
      opening.current = null;
    }
    console.warn("[Billing checkout]", { event: "checkout_failed" });
    toast.error(message, {
      id: BILLING_CHECKOUT_TOAST_ID,
      action: {
        label: "Retry",
        onClick: () => void retryAction.current?.().catch(() => {}),
      },
    });
  }, []);

  const confirm = React.useCallback(
    (id: string) => {
      paymentCompleted.current = true;
      setStatus("confirming");
      setError(undefined);
      verificationTimers.current.forEach(clearTimeout);
      const check = async (attempt = 0) => {
        try {
          const { data } = await axiosClient.get<{ verified: boolean }>(
            `/billing/checkout-status/${id}`,
          );
          invalidateCurrentUser(queryClient);
          if (data.verified) {
            setStatus("verified");
            transaction.current = null;
            clearUrl();
            toast.success(
              "Payment verified. Your billing balance has been refreshed.",
            );
            return;
          }
        } catch {
          // A checkout callback does not prove payment. Keep the authoritative retry bounded.
        }
        if (attempt < 9)
          verificationTimers.current.push(
            setTimeout(() => void check(attempt + 1), 2000),
          );
        else
          fail(
            "Payment verification is still pending. Retry verification shortly; do not pay again.",
          );
      };
      void check();
    },
    [clearUrl, fail, queryClient],
  );

  const handleEvent = React.useCallback(
    (event: PaddleEventData) => {
      if (event.name === "checkout.loaded") {
        setStatus("ready");
        if (opening.current) {
          clearTimeout(opening.current.timer);
          opening.current.resolve();
          opening.current = null;
        }
      } else if (event.name === "checkout.completed") {
        if (opening.current) {
          clearTimeout(opening.current.timer);
          opening.current.resolve();
          opening.current = null;
        }
        const id = event.data?.transaction_id || transaction.current;
        if (id) confirm(id);
      } else if (event.name === "checkout.closed") {
        if (opening.current) {
          clearTimeout(opening.current.timer);
          opening.current.reject(
            new Error("Checkout was closed. You can try again."),
          );
          opening.current = null;
        }
        if (!paymentCompleted.current) {
          setStatus("closed");
          clearUrl();
        }
      } else if (
        [
          "checkout.error",
          "checkout.failed",
          "checkout.payment.error",
          "checkout.payment.failed",
        ].includes(event.name || "")
      ) {
        console.warn("[Billing checkout]", {
          event: "paddle_error",
          code:
            event.code && /^[a-z0-9_.-]{1,80}$/i.test(event.code)
              ? event.code
              : "unknown",
        });
        fail(
          "Paddle could not complete checkout. Check your payment details or retry.",
        );
      }
    },
    [clearUrl, confirm, fail],
  );

  const prepare = React.useCallback(async () => {
    try {
      if (instance.current && environment.current) return environment.current;
      const { data } = await axiosClient.get<{
        environment: PaddleEnvironment;
      }>("/billing/checkout-config");
      const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
      const expected = checkoutEnvironment(
        token,
        data.environment,
        process.env.NEXT_PUBLIC_PADDLE_ENV,
      );
      instance.current = await loadPaddle(token!, expected, dispatch);
      environment.current = expected;
      setError(undefined);
      setStatus("ready");
      return expected;
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : "Checkout could not initialize.";
      fail(message);
      throw new Error(message);
    }
  }, [fail]);

  const openCheckout = React.useCallback(
    async (payload: CheckoutPayload) => {
      const expected = await prepare();
      if (payload.environment !== expected) {
        const message =
          "Checkout environment does not match this transaction. Check Paddle configuration.";
        fail(message);
        throw new Error(message);
      }
      if (!/^txn_[a-z0-9]{26}$/.test(payload.transactionId))
        throw new Error(
          "The server returned an invalid Paddle transaction ID.",
        );
      if (opening.current) throw new Error("Checkout is already opening.");
      transaction.current = payload.transactionId;
      paymentCompleted.current = false;
      // Next's search params react to replaceState; this open already owns the resume link.
      resumeAttempted.current = payload.transactionId;
      setStatus("opening");
      setError(undefined);
      const url = new URL(window.location.href);
      url.searchParams.set("_ptxn", payload.transactionId);
      window.history.replaceState(null, "", url.toString());
      await new Promise<void>((resolve, reject) => {
        opening.current = {
          resolve,
          reject,
          timer: setTimeout(
            () =>
              fail(
                "Paddle checkout did not open. Check script blocking, CSP and checkout domain configuration, then retry.",
              ),
            20000,
          ),
        };
        try {
          instance.current!.Checkout.open({
            transactionId: payload.transactionId,
            settings: {
              displayMode: "overlay",
              theme: resolvedTheme === "light" ? "light" : "dark",
            },
          });
        } catch {
          fail(
            "Paddle checkout could not open. Check its environment and checkout domain, then retry.",
          );
        }
      });
    },
    [fail, prepare, resolvedTheme],
  );

  const resume = React.useCallback(
    async (id: string) => {
      const { data } = await axiosClient.get<{
        environment: PaddleEnvironment;
        status: string;
        verified: boolean;
      }>(`/billing/checkout-status/${id}`);
      if (
        data.verified ||
        ["paid", "completed", "billed"].includes(data.status)
      )
        confirm(id);
      else if (["draft", "ready"].includes(data.status))
        await openCheckout({
          transactionId: id,
          environment: data.environment,
        });
      else
        throw new Error(
          "This checkout has ended. Choose a plan or credit pack to start again.",
        );
    },
    [confirm, openCheckout],
  );

  React.useEffect(() => {
    currentListener = handleEvent;
    return () => {
      if (currentListener === handleEvent) currentListener = undefined;
    };
  }, [handleEvent]);

  React.useEffect(() => {
    const id = params?.get("_ptxn");
    // Paddle.js also auto-opens _ptxn. Capture/remove it BEFORE initialization to avoid two opens.
    if (id && resumeAttempted.current !== id) {
      resumeAttempted.current = id;
      transaction.current = id;
      clearUrl();
      if (/^txn_[a-z0-9]{26}$/.test(id))
        void Promise.resolve()
          .then(() => resume(id))
          .catch((cause: Error) => fail(cause.message));
      else
        queueMicrotask(() =>
          fail("This checkout link has an invalid transaction ID."),
        );
    } else if (!id && !resumeAttempted.current)
      void Promise.resolve()
        .then(() => prepare())
        .catch(() => {});
  }, [clearUrl, fail, params, prepare, resume]);

  React.useEffect(
    () => () => {
      verificationTimers.current.forEach(clearTimeout);
      if (opening.current) clearTimeout(opening.current.timer);
    },
    [],
  );

  const retry = React.useCallback(async () => {
    if (transaction.current)
      await resume(transaction.current).catch((cause: Error) => {
        fail(cause.message);
        throw cause;
      });
    else await prepare();
  }, [resume, fail, prepare]);
  React.useEffect(() => {
    retryAction.current = retry;
    return () => {
      retryAction.current = undefined;
    };
  }, [retry]);
  return (
    <PaddleContext.Provider
      value={{ status, error, prepare, openCheckout, retry }}
    >
      {children}
    </PaddleContext.Provider>
  );
}
