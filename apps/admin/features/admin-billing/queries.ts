import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  adminBillingApi,
  AdjustCreditsPayload,
  CancelSubscriptionPayload,
} from "./api";
import { ListCustomersParams } from "./types";
import { toast } from "sonner";
import { dashboardKeys } from "../admin-dashboard/queries";
import { adminUsersKeys } from "../admin-users/queries";
import { getErrorMessage } from "@/lib/errors";

export const adminBillingKeys = {
  all: ["admin-billing"] as const,
  customers: () => [...adminBillingKeys.all, "customers"] as const,
  customersList: (params?: ListCustomersParams) =>
    [...adminBillingKeys.customers(), params] as const,
  customer: (userId: string) =>
    [...adminBillingKeys.all, "customer", userId] as const,
};

export function useAdminCustomersQuery(params?: ListCustomersParams) {
  return useQuery({
    queryKey: adminBillingKeys.customersList(params),
    queryFn: () => adminBillingApi.listCustomers(params),
    staleTime: 30_000,
  });
}

export function useAdjustCreditsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      userId,
      payload,
    }: {
      userId: string;
      payload: AdjustCreditsPayload;
    }) => adminBillingApi.adjustCredits(userId, payload),
    onSuccess: (_, variables) => {
      toast.success("User credits adjusted successfully");
      queryClient.invalidateQueries({ queryKey: adminBillingKeys.all });
      queryClient.invalidateQueries({
        queryKey: adminUsersKeys.detail(variables.userId),
      });
      queryClient.invalidateQueries({ queryKey: adminUsersKeys.all });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Failed to adjust credits"));
    },
  });
}

export function useCancelSubscriptionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      userId,
      payload,
    }: {
      userId: string;
      payload: CancelSubscriptionPayload;
    }) => adminBillingApi.cancelSubscription(userId, payload),
    onSuccess: (_, variables) => {
      toast.success("Subscription canceled successfully");
      queryClient.invalidateQueries({ queryKey: adminBillingKeys.all });
      queryClient.invalidateQueries({
        queryKey: adminUsersKeys.detail(variables.userId),
      });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Failed to cancel subscription"));
    },
  });
}
