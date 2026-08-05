// TODO: replace placeholders with real Auth types once the auth logic layer is implemented.
// This file is for auth types shared across the feature (forms, session, tokens, etc.).

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  name?: string | null;
  avatarUrl?: string | null;
  emailVerified?: boolean;
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
