import axios from "axios";
import { getSession } from "next-auth/react";

export const axiosClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001",
  timeout: 30_000,
});
axiosClient.interceptors.request.use(async (config) => {
  const session = await getSession();
  if (session?.accessToken) config.headers.Authorization = `Bearer ${session.accessToken}`;
  return config;
});
axiosClient.interceptors.response.use((response) => {
  if (response.data?.success === true && "data" in response.data) response.data = response.data.data;
  return response;
}, (error: unknown) => {
  if (axios.isAxiosError(error)) {
    error.message = error.response?.data?.error?.message || error.response?.data?.message || error.message;
  }
  return Promise.reject(error);
});
