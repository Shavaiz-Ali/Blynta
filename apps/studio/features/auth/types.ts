export type AuthProvider = "local" | "google" | "facebook";
export interface AuthUser {
  id: string;
  email: string;
  role: string;
  accessToken: string;
}
