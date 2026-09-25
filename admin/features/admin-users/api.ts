import { axiosClient } from "@/config/axiosClient";
import {
  AdminUserItem,
  CreateAdminPayload,
  ListUsersParams,
  PaginatedUsersResponse,
  UpdateUserPayload,
  UserDetailResponse,
} from "./types";

export const adminUsersApi = {
  listUsers: async (params?: ListUsersParams): Promise<PaginatedUsersResponse> => {
    const { data } = await axiosClient.get<PaginatedUsersResponse>("/admin/users", { params });
    return data;
  },

  getUserDetail: async (id: string): Promise<UserDetailResponse> => {
    const { data } = await axiosClient.get<UserDetailResponse>(`/admin/users/${id}`);
    return data;
  },

  updateUser: async (
    id: string,
    payload: UpdateUserPayload
  ): Promise<AdminUserItem> => {
    const { data } = await axiosClient.patch<AdminUserItem>(`/admin/users/${id}`, payload);
    return data;
  },

  createAdmin: async (payload: CreateAdminPayload): Promise<AdminUserItem> => {
    const { data } = await axiosClient.post<AdminUserItem>("/admin/users/create-admin", payload);
    return data;
  },
};
