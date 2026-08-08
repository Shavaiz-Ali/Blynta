import type { Metadata } from "next";
import { SignupContainer, getEnabledProviders } from "@/features/auth";

export const metadata: Metadata = {
  title: "Create Account | Blynta",
  description: "Sign up for Blynta to start generating viral short video clips in minutes.",
};

export default async function SignupPage() {
  const enabledProviders = await getEnabledProviders();
  return <SignupContainer enabledProviders={enabledProviders} />;
}
