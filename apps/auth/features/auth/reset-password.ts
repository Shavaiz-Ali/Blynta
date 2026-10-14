"use client";

import { useId } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { axiosClient } from "@/config/axiosClient";

export function useResetTokenValidation(token: string) {
  const instance = useId();
  return useQuery({
    // Keep credentials out of query keys and devtools; validate each new flow.
    queryKey: ["auth", "reset-token-validation", instance],
    queryFn: async ({ signal }) => {
      const { data } = await axiosClient.post<{ valid: boolean }>(
        "/auth/validate-reset-token",
        { token },
        { signal },
      );
      if (typeof data?.valid !== "boolean")
        throw new Error("Unable to verify reset link");
      return data;
    },
    enabled: /^[a-f0-9]{64}$/.test(token),
    retry: false,
    gcTime: 0,
    staleTime: Infinity,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    meta: { sensitive: true },
  });
}

export function useResetPassword(token: string, password: string) {
  return useMutation({
    // Do not retain passwords in mutation variables.
    mutationFn: async () => {
      await axiosClient.post("/auth/reset-password", {
        token,
        newPassword: password,
      });
    },
    retry: false,
    gcTime: 0,
    meta: { sensitive: true },
  });
}
