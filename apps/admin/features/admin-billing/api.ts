import { axiosClient } from "@/config/axiosClient";
import { ListCustomersParams, PaginatedCustomersResponse } from "./types";

export interface AdjustCreditsPayload {
  amount: number;
  reason: string;
}

export interface CancelSubscriptionPayload {
  immediately?: boolean;
  reason?: string;
}

export interface CustomerBillingPicture {
  customer: Record<string, unknown> | null;
  subscriptionEvents: Array<Record<string, unknown>>;
  creditAdjustments: Array<Record<string, unknown>>;
  user: Record<string, unknown> | null;
}

export interface CreditAdjustmentResult {
  success: boolean;
  previousBalance: number;
  newBalance: number;
  creditAdjustment: Record<string, unknown>;
}

export interface CancellationResult {
  message: string;
  customer: Record<string, unknown> | null;
}

export const adminBillingApi = {
  listCustomers: async (
    params?: ListCustomersParams,
  ): Promise<PaginatedCustomersResponse> => {
    const { data } = await axiosClient.get<PaginatedCustomersResponse>(
      "/admin/billing/customers",
      { params },
    );
    return data;
  },

  getCustomerBilling: async (
    userId: string,
  ): Promise<CustomerBillingPicture> => {
    const { data } = await axiosClient.get<CustomerBillingPicture>(
      `/admin/billing/customers/${userId}`,
    );
    return data;
  },

  adjustCredits: async (
    userId: string,
    payload: AdjustCreditsPayload,
  ): Promise<CreditAdjustmentResult> => {
    const { data } = await axiosClient.post<CreditAdjustmentResult>(
      `/admin/billing/customers/${userId}/adjust-credits`,
      payload,
    );
    return data;
  },

  cancelSubscription: async (
    userId: string,
    payload: CancelSubscriptionPayload,
  ): Promise<CancellationResult> => {
    const { data } = await axiosClient.post<CancellationResult>(
      `/admin/billing/customers/${userId}/cancel-subscription`,
      payload,
    );
    return data;
  },
};
