import { authSecret } from "@blynta/auth/backend";
import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import Facebook from "next-auth/providers/facebook";
import {
  callIdentity,
  IdentityRequestError,
  sessionCallbacks,
} from "@blynta/auth/server";

class IdentitySignInError extends CredentialsSignin {
  constructor(code: string) {
    super();
    this.code = code;
  }
}

type Identity = {
  id: string;
  email: string;
  role: string;
  accessToken: string;
  sessionToken: string;
  expiresAt: number;
  accessTokenExpires: number;
};
const shared = sessionCallbacks("consumer", "all");
export const identityCookieName = `${process.env.NODE_ENV === "production" ? "__Host-" : ""}blynta-identity-session`;
export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: authSecret("blynta-identity"),
  trustHost: true,
  logger: {
    error(error) {
      if (error instanceof CredentialsSignin) {
        console.warn(`[auth] Sign-in rejected: ${error.code}`);
        return;
      }
      console.error(`[auth] Authentication error: ${error.name}`);
    },
  },
  pages: { signIn: "/login", error: "/login" },
  session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60 },
  cookies: {
    sessionToken: {
      name: identityCookieName,
      options: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
      },
    },
  },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        if (
          typeof credentials.email !== "string" ||
          typeof credentials.password !== "string"
        )
          return null;
        try {
          return await callIdentity<Identity>(
            "sso/login",
            { email: credentials.email, password: credentials.password },
            true,
          );
        } catch (error) {
          const code =
            error instanceof IdentityRequestError
              ? error.code
              : "backend_unavailable";
          if (
            error instanceof IdentityRequestError &&
            code !== "invalid_credentials"
          ) {
            console.error(
              `[auth:credentials] Identity service failure: ${JSON.stringify({ code, status: error.status })}`,
            );
          }
          throw new IdentitySignInError(code);
        }
      },
    }),
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            checks: ["pkce", "state"],
          }),
        ]
      : []),
    ...(process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET
      ? [
          Facebook({
            clientId: process.env.FACEBOOK_CLIENT_ID,
            clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
            checks: ["state"],
          }),
        ]
      : []),
  ],
  events: shared.events,
  callbacks: {
    ...shared.callbacks,
    async signIn({ user, account, profile }) {
      if (!account || account.provider === "credentials") return true;
      if (!["google", "facebook"].includes(account.provider)) return false;
      if (
        account.provider === "google" &&
        (profile as { email_verified?: boolean })?.email_verified !== true
      )
        return false;
      try {
        const social = await callIdentity<{ accessToken: string }>(
          account.provider,
          {
            providerId: account.providerAccountId,
            email: user.email || "",
            name: user.name || "",
            ...(user.image ? { avatarUrl: user.image } : {}),
          },
          true,
        );
        Object.assign(
          user,
          await callIdentity<Identity>(
            "sso/identity",
            { accessToken: social.accessToken },
            true,
          ),
        );
        return true;
      } catch {
        return false;
      }
    },
  },
});
