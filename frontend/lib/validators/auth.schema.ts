import { z } from "zod";

const nonEmptyString = (msg: string) =>
  z.string().refine((v) => typeof v === "string" && v.trim().length > 0, msg);

export const nameSchema = nonEmptyString("Name is required")
  .trim()
  .refine((v) => v.length >= 2, "Name must be at least 2 characters")
  .refine((v) => v.length <= 80, "Name is too long");

export const emailSchema = nonEmptyString("Email address is required")
  .trim()
  .refine((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Enter a valid email address");

export const passwordSchema = nonEmptyString("Password is required")
  .refine((v) => v.length >= 8, "Password must be at least 8 characters")
  .refine((v) => /[A-Za-z]/.test(v), "Password must include at least one letter")
  .refine((v) => /\d/.test(v), "Password must include at least one number");

export const loginSchema = z.object({
  email: emailSchema,
  password: nonEmptyString("Password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const emailVerificationSchema = z.object({
  code: nonEmptyString("Verification code is required").refine(
    (v) => /^\d{6}$/.test(v),
    "Enter the 6-digit code"
  ),
});

export type EmailVerificationInput = z.infer<typeof emailVerificationSchema>;
