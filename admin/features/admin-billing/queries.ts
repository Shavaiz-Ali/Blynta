import { useQuery } from "@tanstack/react-query";
import { adminBillingApi } from "./api";
import { ListCustomersParams, ListEventsParams } from "./types";

export const adminBillingKeys = {
  all: ["admin-billing"] as const,
  customers: () => [...adminBillingKeys.all, "customers"] as const,
  customerList: (params?: ListCustomersParams) => [...adminBillingKeys.customers(), params] as const,
  events: () => [...adminBillingKeys.all, "events"] as const,
  eventList: (params?: ListEventsParams) => [...adminBillingKeys.events(), params] as const,
};

export function useAdminCustomersQuery(params?: ListCustomersParams) {
  return useQuery({
    queryKey: adminBillingKeys.customerList(params),
    queryFn: () => adminBillingApi.listCustomers(params),
  });
}

export function useAdminEventsQuery(params?: ListEventsParams) {
  return useQuery({
    queryKey: adminBillingKeys.eventList(params),
    queryFn: () => adminBillingApi.listEvents(params),
  });
}
