import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { adminUsersApi } from "./api";
import { CreateAdminPayload, ListUsersParams, UpdateUserPayload } from "./types";
import { getErrorMessage } from "@/lib/errors";

export const adminUserKeys = {
  all: ["admin-users"] as const,
  lists: () => [...adminUserKeys.all, "list"] as const,
  list: (params?: ListUsersParams) => [...adminUserKeys.lists(), params] as const,
  details: () => [...adminUserKeys.all, "detail"] as const,
  detail: (id: string) => [...adminUserKeys.details(), id] as const,
};
export const adminUsersKeys = adminUserKeys;

export function useAdminUsersQuery(params?: ListUsersParams) {
  return useQuery({
    queryKey: adminUserKeys.list(params),
    queryFn: () => adminUsersApi.listUsers(params),
  });
}

export function useAdminUserDetailQuery(id: string) {
  return useQuery({
    queryKey: adminUserKeys.detail(id),
    queryFn: () => adminUsersApi.getUserDetail(id),
    enabled: !!id,
  });
}

export function useUpdateAdminUserMutation(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpdateUserPayload) =>
      adminUsersApi.updateUser(userId, payload),
    onSuccess: () => {
      toast.success("User updated successfully");
      queryClient.invalidateQueries({ queryKey: adminUserKeys.all });
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Failed to update user"));
    },
  });
}

export function useCreateAdminMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateAdminPayload) => adminUsersApi.createAdmin(payload),
    onSuccess: () => {
      toast.success("Admin account created successfully");
      queryClient.invalidateQueries({ queryKey: adminUserKeys.all });
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Failed to create admin"));
    },
  });
}
