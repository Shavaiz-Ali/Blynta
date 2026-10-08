import { cookies } from "next/headers";
import { decode } from "next-auth/jwt";
import { authSecret } from "@blynta/auth/backend";
import { NextResponse } from "next/server";
import { configuredUrl } from "@blynta/auth/server";
import { pendingName, recovery } from "@/lib/authorization";
export async function GET(request: Request) {
  const jar = await cookies();
  const client = new URL(request.url).searchParams.get("client") || undefined;
  let state = new URL(request.url).searchParams.get("transaction");
  if (!state) {
    const pointer = jar.get(pendingName())?.value;
    if (pointer) {
      try {
        state = JSON.parse(pointer).state;
      } catch {
        return recovery(
          request,
          client,
          "transaction_expired",
          state || undefined,
        );
      }
    }
  }
  if (state) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(state))
      return recovery(
        request,
        client,
        "transaction_expired",
        state || undefined,
      );
    try {
      const pending = await decode({
        token: jar.get(pendingName(state))?.value,
        secret: authSecret("blynta-identity")!,
        salt: pendingName(state),
      });
      if (!pending || pending.state !== state)
        return recovery(
          request,
          client,
          "transaction_expired",
          state || undefined,
        );
      const url = new URL("/authorize", configuredUrl("AUTH_APP_URL"));
      for (const key of [
        "client_id",
        "redirect_uri",
        "response_type",
        "state",
        "code_challenge",
        "code_challenge_method",
      ]) {
        if (typeof pending[key] !== "string")
          return recovery(
            request,
            client,
            "transaction_expired",
            state || undefined,
          );
        url.searchParams.set(key, pending[key] as string);
      }
      const response = NextResponse.redirect(url);
      response.headers.set("Cache-Control", "no-store");
      response.headers.set("Referrer-Policy", "no-referrer");
      return response;
    } catch {
      return recovery(
        request,
        client,
        "transaction_expired",
        state || undefined,
      );
    }
  }
  return NextResponse.redirect(
    new URL("/auth/start", configuredUrl("MAIN_APP_URL")),
  );
}
