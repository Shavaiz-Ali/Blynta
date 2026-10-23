"use client";

import {
  useMutation,
  UseMutationOptions,
  UseMutationResult,
  useQueryClient,
  useQuery,
} from "@tanstack/react-query";
import { axiosClient } from "@/config/axiosClient";
import { userQueryKeys } from "@/features/auth/queries";
import type {
  CreditBalance,
  CreditHistoryPage,
  BillingPlan,
  PaidPlan,
} from "@blynta/types";
import {
  billingKeys,
  BILLING_ENDPOINTS,
  CREDIT_HISTORY_PAGE_SIZE,
} from "./constants";
import { useEffect, useRef } from "react";
import { usePaddle, type CheckoutPayload } from "./paddle-context";
export { invalidateCurrentUser } from "./cache";

export function useCreditBalance() {
  const client = useQueryClient();
  const previous = useRef<string | undefined>(undefined);
  const result = useQuery({
    queryKey: billingKeys.credits(),
    queryFn: async () =>
      (await axiosClient.get<CreditBalance>(BILLING_ENDPOINTS.credits)).data,
    refetchInterval: (query) => (query.state.data?.reserved ? 5000 : 30000),
    staleTime: 5000,
  });
  const signature = result.data
    ? JSON.stringify([
        result.data.available,
        result.data.reserved,
        result.data.plan,
        result.data.totalGranted,
        result.data.totalConsumed,
        result.data.paymentCreditsOwed,
      ])
    : undefined;
  useEffect(() => {
    if (previous.current !== undefined && signature !== previous.current) {
      void client.invalidateQueries({ queryKey: userQueryKeys.me() });
      void client.invalidateQueries({ queryKey: billingKeys.history });
    }
    previous.current = signature;
  }, [client, signature]);
  return result;
}
export function useCreditHistory(page: number, product: string, type: string) {
  return useQuery({
    queryKey: billingKeys.historyPage(page, product, type),
    queryFn: async () =>
      (
        await axiosClient.get<CreditHistoryPage>(BILLING_ENDPOINTS.history, {
          params: {
            page,
            limit: CREDIT_HISTORY_PAGE_SIZE,
            ...(product ? { product } : {}),
            ...(type ? { type } : {}),
          },
        })
      ).data,
  });
}

/* -------------------------------------------------------------------------- */
/*                              Types & DTOs                                  */
/* -------------------------------------------------------------------------- */

export type BillingPlanTier = PaidPlan;

export type CreateCheckoutSessionInput = {
  plan: BillingPlanTier;
};

export type CheckoutSessionResult = CheckoutPayload;

/* -------------------------------------------------------------------------- */
/*              useCreateCheckoutSession — POST /billing/checkout-session     */
/* -------------------------------------------------------------------------- */

type CreateCheckoutOpts = Omit<
  UseMutationOptions<
    CheckoutSessionResult,
    Error,
    CreateCheckoutSessionInput,
    unknown
  >,
  "mutationFn"
>;

export function useCreateCheckoutSession(
  opts: CreateCheckoutOpts = {},
): UseMutationResult<CheckoutSessionResult, Error, CreateCheckoutSessionInput> {
  const checkout = usePaddle();
  const { onSuccess: userOnSuccess, ...restOpts } = opts;

  return useMutation({
    mutationFn: async (input) => {
      await checkout.prepare();
      const { data } = await axiosClient.post<CheckoutSessionResult>(
        BILLING_ENDPOINTS.checkout,
        input,
      );
      await checkout.openCheckout(data);
      return data;
    },
    onSuccess: async (data, vars, ctx, mutationContext) => {
      if (userOnSuccess) userOnSuccess(data, vars, ctx, mutationContext);
    },
    ...restOpts,
  });
}

/* -------------------------------------------------------------------------- */
/*              useCustomerPortal — GET /billing/customer-portal               */
/* -------------------------------------------------------------------------- */

export function useCustomerPortal() {
  return useMutation({
    mutationFn: async () => {
      const { data } = await axiosClient.get<{ url: string }>(
        BILLING_ENDPOINTS.portal,
      );
      return data;
    },
    onSuccess: (data) => {
      if (data?.url && typeof window !== "undefined") {
        window.location.href = data.url;
      }
    },
  });
}

export interface CreditPack {
  id: string;
  credits: number;
  enabled: boolean;
  configurationError: string | null;
  price?: { amount: string; currencyCode: string };
}

export function useCreditPacks() {
  return useQuery({
    queryKey: billingKeys.packs(),
    queryFn: async () =>
      (await axiosClient.get<CreditPack[]>(BILLING_ENDPOINTS.packs)).data,
    staleTime: 60000,
  });
}

export function useCreditPackCheckout() {
  const checkout = usePaddle();
  return useMutation({
    mutationFn: async (packId: string) => {
      await checkout.prepare();
      const { data } = await axiosClient.post<CheckoutPayload>(
        BILLING_ENDPOINTS.packCheckout,
        { packId },
      );
      await checkout.openCheckout(data);
      return data;
    },
  });
}

export function useBillingPlans() {
  return useQuery({
    queryKey: billingKeys.plans(),
    queryFn: async () =>
      (await axiosClient.get<BillingPlan[]>(BILLING_ENDPOINTS.plans)).data,
    staleTime: 60000,
  });
}
