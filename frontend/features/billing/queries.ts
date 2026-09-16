import {
  QueryClient,
  useMutation,
  UseMutationOptions,
  UseMutationResult,
  useQueryClient,
} from "@tanstack/react-query";
import { axiosClient } from "@/config/axiosClient";
import { userQueryKeys } from "@/features/auth/queries";

/* -------------------------------------------------------------------------- */
/*                              Types & DTOs                                  */
/* -------------------------------------------------------------------------- */

export type BillingPlanTier = "pro" | "business";

export type CreateCheckoutSessionInput = {
  plan: BillingPlanTier;
};

export type CheckoutSessionResult = {
  checkoutUrl: string;
};

/* -------------------------------------------------------------------------- */
/*              useCreateCheckoutSession — POST /billing/checkout-session     */
/* -------------------------------------------------------------------------- */

type CreateCheckoutOpts = Omit<
  UseMutationOptions<CheckoutSessionResult, Error, CreateCheckoutSessionInput, unknown>,
  "mutationFn"
>;

export function useCreateCheckoutSession(
  opts: CreateCheckoutOpts = {}
): UseMutationResult<CheckoutSessionResult, Error, CreateCheckoutSessionInput> {
  const queryClient = useQueryClient();
  const { onSuccess: userOnSuccess, ...restOpts } = opts;

  return useMutation({
    mutationFn: async (input) => {
      const { data } = await axiosClient.post<CheckoutSessionResult>(
        "/billing/checkout-session",
        input
      );
      return data;
    },
    onSuccess: async (data, vars, ctx) => {
      // Invalidate current user so any plan/credits updates show immediately
      // once the user returns from Paddle (and the browser refetches).
      invalidateCurrentUser(queryClient);

      if (data?.checkoutUrl) {
        // Full page navigation to Paddle hosted checkout — NOT client-side.
        if (typeof window !== "undefined") {
          window.location.href = data.checkoutUrl;
        }
      }

      if (userOnSuccess) (userOnSuccess as any)(data, vars, ctx);
    },
    ...restOpts,
  });
}

/* -------------------------------------------------------------------------- */
/*              useCustomerPortal — GET /billing/customer-portal               */
/* -------------------------------------------------------------------------- */

export function useCustomerPortal() {
  return useMutation({
    mutationFn: async () => {
      const { data } = await axiosClient.get<{ url: string }>(
        "/billing/customer-portal"
      );
      return data;
    },
    onSuccess: (data) => {
      if (data?.url && typeof window !== "undefined") {
        window.location.href = data.url;
      }
    },
  });
}

export function invalidateCurrentUser(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: userQueryKeys.me() });
}
