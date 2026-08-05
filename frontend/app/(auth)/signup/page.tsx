import type { Metadata } from "next";
import { SignupContainer } from "@/features/auth";

export const metadata: Metadata = {
  title: "Create Account | Blynta",
  description: "Sign up for Blynta to start generating viral short video clips in minutes.",
};

export default function SignupPage() {
  return <SignupContainer />;
}
