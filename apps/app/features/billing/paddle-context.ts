"use client";
import { createContext, useContext } from "react";

export type PaddleEnvironment = "sandbox" | "production";
export interface CheckoutPayload {
  transactionId: string;
  environment: PaddleEnvironment;
  checkoutUrl?: string;
}
export interface PaddleCheckoutContext {
  status:
    | "loading"
    | "ready"
    | "opening"
    | "confirming"
    | "verified"
    | "closed"
    | "error";
  error?: string;
  openCheckout: (payload: CheckoutPayload) => Promise<void>;
  prepare: () => Promise<PaddleEnvironment>;
  retry: () => Promise<void>;
}
export const PaddleContext = createContext<PaddleCheckoutContext | null>(null);
export function usePaddle() {
  const value = useContext(PaddleContext);
  if (!value) throw new Error("Billing checkout requires PaddleProvider");
  return value;
}
