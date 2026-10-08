/** Stable contracts shared by the frontends; product-specific profile fields stay in their app. */
export type {
  CreditBalance,
  CreditEstimate,
  CreditTransaction,
  CreditHistoryPage,
} from "./billing";
export type UserRole = "user" | "admin";
export type ProductId = "blynta-main" | "blynta-studio" | "blynta-admin";
export interface AuthUser {
  id: string;
  email: string;
  role: string;
  name?: string | null;
  avatarUrl?: string | null;
  emailVerified?: boolean;
}
export type ApiEnvelope<T> =
  | { success: true; data: T }
  | { success: false; error: { message: string; code: string } };
