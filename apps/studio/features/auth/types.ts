import type {
  AuthProvider as SharedAuthProvider,
  UserRole,
} from "@blynta/types";
export type AuthProvider = Extract<
  SharedAuthProvider,
  "local" | "google" | "facebook"
>;
export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  accessToken: string;
}
