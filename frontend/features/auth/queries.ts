import {
  QueryClient,
  useMutation,
  UseMutationOptions,
  UseMutationResult,
  useQuery,
  useQueryClient,
  UseQueryOptions,
  UseQueryResult,
} from "@tanstack/react-query";
import { axiosClient } from "@/config/axiosClient";
import type { UserProfile } from "@/features/auth/types";

/* -------------------------------------------------------------------------- */
/*                              Query keys                                    */
/* -------------------------------------------------------------------------- */

export const userQueryKeys = {
  all: ["user"] as const,
  me: () => [...userQueryKeys.all, "me"] as const,
  referrals: () => [...userQueryKeys.all, "referrals"] as const,
  referralStats: () => [...userQueryKeys.all, "referral-stats"] as const,
};

/* -------------------------------------------------------------------------- */
/*                                Types                                       */
/* -------------------------------------------------------------------------- */

export type MarkWelcomedResult = { message: string };

export interface ReferralStatsResult {
  referralCode: string;
  successfulReferralCount: number;
  maxReferrals: number;
  totalCreditsEarned: number;
}

export interface SendReferralInviteResult {
  message: string;
}

/* -------------------------------------------------------------------------- */
/*                           useCurrentUser — GET /users/me                   */
/* -------------------------------------------------------------------------- */

export function useCurrentUser(
  opts?: Omit<UseQueryOptions<UserProfile, Error>, "queryKey" | "queryFn">
): UseQueryResult<UserProfile, Error> {
  return useQuery({
    queryKey: userQueryKeys.me(),
    queryFn: async () => {
      const { data } = await axiosClient.get<UserProfile>("/users/me");
      return data;
    },
    staleTime: 1000 * 30,
    ...opts,
  });
}

/* -------------------------------------------------------------------------- */
/*                       useUpdateProfile — PATCH /users/me                    */
/* -------------------------------------------------------------------------- */

export interface UpdateProfileInput {
  name: string;
}

export interface UpdateProfileResult {
  id: string;
  name: string;
}

type UpdateProfileOpts = Omit<
  UseMutationOptions<UpdateProfileResult, Error, UpdateProfileInput, unknown>,
  "mutationFn"
>;

export function useUpdateProfile(
  opts: UpdateProfileOpts = {}
): UseMutationResult<UpdateProfileResult, Error, UpdateProfileInput, unknown> {
  const queryClient = useQueryClient();
  const { onSuccess: userOnSuccess, ...restOpts } = opts;
  return useMutation({
    mutationFn: async (data: UpdateProfileInput) => {
      const { data: res } = await axiosClient.patch<UpdateProfileResult>(
        "/users/me",
        data
      );
      return res;
    },
    onSuccess: (...args: any[]) => {
      invalidateCurrentUser(queryClient);
      if (userOnSuccess) (userOnSuccess as any)(...args);
    },
    ...restOpts,
  });
}

/* -------------------------------------------------------------------------- */
/*                       useUploadAvatar — POST /users/me/avatar               */
/* -------------------------------------------------------------------------- */

export interface UploadAvatarResult {
  avatarUrl: string;
}

type UploadAvatarOpts = Omit<
  UseMutationOptions<UploadAvatarResult, Error, File, unknown>,
  "mutationFn"
>;

export function useUploadAvatar(
  opts: UploadAvatarOpts = {}
): UseMutationResult<UploadAvatarResult, Error, File, unknown> {
  const queryClient = useQueryClient();
  const { onSuccess: userOnSuccess, ...restOpts } = opts;
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("avatar", file);
      const { data } = await axiosClient.post<UploadAvatarResult>(
        "/users/me/avatar",
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );
      return data;
    },
    onSuccess: (...args: any[]) => {
      invalidateCurrentUser(queryClient);
      if (userOnSuccess) (userOnSuccess as any)(...args);
    },
    ...restOpts,
  });
}

/* -------------------------------------------------------------------------- */
/*               useChangePassword — POST /users/me/change-password           */
/* -------------------------------------------------------------------------- */

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export interface ChangePasswordResult {
  message: string;
}

type ChangePasswordOpts = Omit<
  UseMutationOptions<ChangePasswordResult, Error, ChangePasswordInput, unknown>,
  "mutationFn"
>;

export function useChangePassword(
  opts: ChangePasswordOpts = {}
): UseMutationResult<ChangePasswordResult, Error, ChangePasswordInput, unknown> {
  return useMutation({
    mutationFn: async (data: ChangePasswordInput) => {
      const { data: res } = await axiosClient.post<ChangePasswordResult>(
        "/users/me/change-password",
        data
      );
      return res;
    },
    ...opts,
  });
}

/* -------------------------------------------------------------------------- */
/*                       useMarkWelcomed — PATCH /users/me/welcomed           */
/* -------------------------------------------------------------------------- */

type MarkWelcomedOpts = Omit<
  UseMutationOptions<MarkWelcomedResult, Error, void, unknown>,
  "mutationFn"
>;

export function useMarkWelcomed(
  opts: MarkWelcomedOpts = {}
): UseMutationResult<MarkWelcomedResult, Error, void, unknown> {
  const queryClient = useQueryClient();
  const { onSuccess: userOnSuccess, ...restOpts } = opts;
  return useMutation({
    mutationFn: async () => {
      const { data } = await axiosClient.patch<MarkWelcomedResult>(
        "/users/me/welcomed"
      );
      return data;
    },
    onSuccess: (...args: any[]) => {
      invalidateCurrentUser(queryClient);
      if (userOnSuccess) (userOnSuccess as any)(...args);
    },
    ...restOpts,
  });
}

/* -------------------------------------------------------------------------- */
/*             useReferralStats — GET /users/referrals/stats                 */
/* -------------------------------------------------------------------------- */

export function useReferralStats(
  opts?: Omit<UseQueryOptions<ReferralStatsResult, Error>, "queryKey" | "queryFn">
): UseQueryResult<ReferralStatsResult, Error> {
  return useQuery({
    queryKey: userQueryKeys.referralStats(),
    queryFn: async () => {
      const { data } = await axiosClient.get<ReferralStatsResult>(
        "/users/referrals/stats"
      );
      return data;
    },
    staleTime: 1000 * 60,
    ...opts,
  });
}

/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/*           useSendReferralInvite — POST /users/referrals/invite             */
/* -------------------------------------------------------------------------- */

type SendReferralInviteOpts = Omit<
  UseMutationOptions<SendReferralInviteResult, Error, string, unknown>,
  "mutationFn"
>;

export function useSendReferralInvite(
  opts: SendReferralInviteOpts = {}
): UseMutationResult<SendReferralInviteResult, Error, string, unknown> {
  const queryClient = useQueryClient();
  const { onSuccess: userOnSuccess, ...restOpts } = opts;
  return useMutation({
    mutationFn: async (email: string) => {
      const { data } = await axiosClient.post<SendReferralInviteResult>(
        "/users/referrals/invite",
        { email }
      );
      return data;
    },
    onSuccess: (...args: any[]) => {
      queryClient.invalidateQueries({ queryKey: userQueryKeys.referralStats() });
      if (userOnSuccess) (userOnSuccess as any)(...args);
    },
    ...restOpts,
  });
}

/* -------------------------------------------------------------------------- */
/*                     useSignup — POST /auth/signup                          */
/* -------------------------------------------------------------------------- */

export interface SignupInput {
  name?: string;
  email: string;
  password: string;
  ref?: string;
}

export interface SignupResult {
  id: string;
  email: string;
}

type SignupOpts = Omit<
  UseMutationOptions<SignupResult, Error, SignupInput, unknown>,
  "mutationFn"
>;

export function useSignup(
  opts: SignupOpts = {}
): UseMutationResult<SignupResult, Error, SignupInput, unknown> {
  return useMutation({
    mutationFn: async (input: SignupInput) => {
      const { data } = await axiosClient.post<SignupResult>(
        "/auth/signup",
        input
      );
      return data;
    },
    ...opts,
  });
}

/* -------------------------------------------------------------------------- */
/*                   useVerifyOtp — POST /auth/verify-otp                     */
/* -------------------------------------------------------------------------- */

export interface VerifyOtpInput {
  email: string;
  otp: string;
}

export interface VerifyOtpResult {
  message: string;
  accessToken?: string;
}

type VerifyOtpOpts = Omit<
  UseMutationOptions<VerifyOtpResult, Error, VerifyOtpInput, unknown>,
  "mutationFn"
>;

export function useVerifyOtp(
  opts: VerifyOtpOpts = {}
): UseMutationResult<VerifyOtpResult, Error, VerifyOtpInput, unknown> {
  return useMutation({
    mutationFn: async (input: VerifyOtpInput) => {
      const { data } = await axiosClient.post<VerifyOtpResult>(
        "/auth/verify-otp",
        input
      );
      return data;
    },
    ...opts,
  });
}

/* -------------------------------------------------------------------------- */
/*                   useResendOtp — POST /auth/resend-otp                     */
/* -------------------------------------------------------------------------- */

export interface ResendOtpResult {
  message: string;
}

type ResendOtpOpts = Omit<
  UseMutationOptions<ResendOtpResult, Error, string, unknown>,
  "mutationFn"
>;

export function useResendOtp(
  opts: ResendOtpOpts = {}
): UseMutationResult<ResendOtpResult, Error, string, unknown> {
  return useMutation({
    mutationFn: async (email: string) => {
      const { data } = await axiosClient.post<ResendOtpResult>(
        "/auth/resend-otp",
        { email }
      );
      return data;
    },
    ...opts,
  });
}

export function invalidateCurrentUser(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: userQueryKeys.me() });
}


/* -------------------------------------------------------------------------- */
/*                   useForgotPassword — POST /auth/forgot-password                     */
/* -------------------------------------------------------------------------- */

export interface ForgotPasswordInput {
  email: string;
}

export interface ForgotPasswordResult {
  message: string;
}

type ForgotPasswordOpts = Omit<
  UseMutationOptions<ForgotPasswordResult, Error, ForgotPasswordInput, unknown>,
  "mutationFn"
>;

export function useForgotPassword(
  opts: ForgotPasswordOpts = {}
): UseMutationResult<ForgotPasswordResult, Error, ForgotPasswordInput, unknown> {
  return useMutation({
    mutationFn: async (input: ForgotPasswordInput) => {
      const { data } = await axiosClient.post<ForgotPasswordResult>(
        "/auth/forgot-password",
        input
      );
      return data;
    },
    ...opts,
  });
}

