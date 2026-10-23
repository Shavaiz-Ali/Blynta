export const USER_ROLE = { USER: "user", ADMIN: "admin" } as const;
export type UserRole = (typeof USER_ROLE)[keyof typeof USER_ROLE];
export const AUTH_PROVIDER = {
  LOCAL: "local",
  GOOGLE: "google",
  FACEBOOK: "facebook",
  APPLE: "apple",
  GITHUB: "github",
} as const;
export type AuthProvider = (typeof AUTH_PROVIDER)[keyof typeof AUTH_PROVIDER];
export const authQueryKeys = {
  providers: () => ["auth", "providers"] as const,
};
// Preserve existing cache identities across the consumer apps.
export const userQueryKeys = {
  all: ["user"] as const,
  me: () => ["user", "me"] as const,
  referrals: () => ["user", "referrals"] as const,
  referralStats: () => ["user", "referral-stats"] as const,
};
