// TODO: replace placeholders with real Auth types once the auth logic layer is implemented.
// This file is for auth types shared across the feature (forms, session, tokens, etc.).

export type AuthProvider =
  | "local"
  | "google"
  | "facebook"
  | "apple"
  | "github";

export type UserPlan = "free" | "pro" | "business";
export type UserRole = "user" | "admin";

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  name?: string | null;
  avatarUrl?: string | null;
  emailVerified?: boolean;
}

/**
 * Shape returned by GET /users/me (the NestJS backend profile endpoint),
 * unwrapped from the { success, data } envelope.
 */
export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatarUrl: string;
  plan: UserPlan;
  creditsBalance: number;
  creditsResetAt: string;
  role: UserRole;
  isWelcomed: boolean;
  referralCode: string
}

export interface AuthSession {
  user: AuthUser | null;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  name: string;
  email: string;
  password: string;
}

export interface PasswordResetRequest {
  email: string;
}

export interface EmailVerificationRequest {
  code: string;
}
