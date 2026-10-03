import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import Facebook from "next-auth/providers/facebook";
import { backendUrl } from "@/config/env";
type BackendUser = {
  id: string;
  email: string;
  role: string;
  accessToken: string;
};
async function callBackend(
  path: string,
  body: Record<string, string>,
): Promise<BackendUser> {
  const response = await fetch(`${backendUrl()}/auth/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-blynta-auth-bridge": process.env.SSO_BRIDGE_SECRET || "",
    },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  const json = await response.json();
  if (!response.ok || !json.success) throw new Error("Authentication failed");
  return json.data;
}
export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  pages: { signIn: "/login", error: "/login" },
  session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60 },
  // Both apps must explicitly configure matching cookie domain/name/secret for SSO.
  ...(process.env.AUTH_COOKIE_DOMAIN
    ? {
        cookies: {
          sessionToken: {
            name:
              process.env.AUTH_COOKIE_NAME || "__Secure-authjs.session-token",
            options: {
              httpOnly: true,
              sameSite: "lax" as const,
              path: "/",
              secure: true,
              domain: process.env.AUTH_COOKIE_DOMAIN,
            },
          },
        },
      }
    : {}),
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(c) {
        if (typeof c.email !== "string" || typeof c.password !== "string")
          return null;
        try {
          return await callBackend("login", {
            email: c.email,
            password: c.password,
          });
        } catch {
          return null;
        }
      },
    }),
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
    ...(process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET
      ? [
          Facebook({
            clientId: process.env.FACEBOOK_CLIENT_ID,
            clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
          }),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (!account || account.provider === "credentials") return true;
      if (!["google", "facebook"].includes(account.provider)) return false;
      try {
        Object.assign(
          user,
          await callBackend(account.provider, {
            providerId: profile?.sub || account.providerAccountId,
            email: user.email || "",
            name: user.name || "",
            avatarUrl: user.image || "",
          }),
        );
        return true;
      } catch {
        return false;
      }
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role || "user";
        token.accessToken = user.accessToken;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id || "";
      session.user.role = token.role || "user";
      session.accessToken = token.accessToken;
      return session;
    },
  },
});
