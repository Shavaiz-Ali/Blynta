import { billingKeys } from "./constants";
import type { QueryClient } from "@tanstack/react-query";
import { userQueryKeys } from "@/features/auth/queries";

export function invalidateCurrentUser(client: QueryClient) {
  void client.invalidateQueries({ queryKey: userQueryKeys.me() });
  void client.invalidateQueries({ queryKey: billingKeys.all });
}
