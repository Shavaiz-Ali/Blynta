import { axiosClient } from "@/config/axiosClient";
import {
  ListCustomersParams,
  PaginatedCustomersResponse,
  ListEventsParams,
  PaginatedEventsResponse,
} from "./types";

export const adminBillingApi = {
  listCustomers: async (params?: ListCustomersParams): Promise<PaginatedCustomersResponse> => {
    const { data } = await axiosClient.get<PaginatedCustomersResponse>("/admin/billing/customers", { params });
    return data;
  },

  listEvents: async (params?: ListEventsParams): Promise<PaginatedEventsResponse> => {
    const { data } = await axiosClient.get<PaginatedEventsResponse>("/admin/billing/events", { params });
    return data;
  },
};
