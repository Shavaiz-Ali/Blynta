import "next-auth/jwt";
import type { DefaultSession } from "next-auth";
declare module "next-auth" {
  interface Session {
    user: { id: string; role: string } & DefaultSession["user"];
    accessToken?: string;
  }
  interface User {
    role?: string;
    accessToken?: string;
    sessionToken?: string;
    expiresAt?: number;
    accessTokenExpires?: number;
  }
}
declare module "next-auth/jwt" {
  interface JWT {
    sessionKind?: "consumer" | "admin";
    id?: string;
    role?: string;
    accessToken?: string;
    sessionToken?: string;
    expiresAt?: number;
    accessTokenExpires?: number;
  }
}
