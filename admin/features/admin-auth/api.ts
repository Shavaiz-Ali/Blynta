import { axiosClient } from "@/config/axiosClient";
import { AdminUser, LoginCredentials } from "./types";

export const adminAuthApi = {
  login: async (credentials: LoginCredentials): Promise<AdminUser> => {
    const { data } = await axiosClient.post<AdminUser>("/auth/login", credentials);
    return data;
  },
  getMe: async (): Promise<AdminUser> => {
    const { data } = await axiosClient.get<AdminUser>("/users/me");
    return data;
  },
};
