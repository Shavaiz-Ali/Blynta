import { backendUrl } from "@/config/env";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  emailSchema,
  passwordSchema,
  nameSchema,
} from "@/lib/validators/auth.schema";
const schemas = {
  signup: z.object({
    name: nameSchema,
    email: emailSchema,
    password: passwordSchema,
  }),
  "forgot-password": z.object({ email: emailSchema }),
  "reset-password": z.object({
    token: z.string().min(1),
    newPassword: passwordSchema,
  }),
  "verify-otp": z.object({
    email: emailSchema,
    otp: z.string().regex(/^\d{6}$/),
  }),
  "resend-otp": z.object({ email: emailSchema }),
};
export async function accountHandler(
  request: Request,
  context: { params: Promise<{ action: string }> },
) {
  if (process.env.CENTRAL_AUTH_ENABLED === "true")
    return NextResponse.json({ success: false }, { status: 404 });
  const { action } = await context.params;
  const isProviders = action === "providers" && request.method === "GET";
  const schema = schemas[action as keyof typeof schemas];
  if (!isProviders && (!schema || request.method !== "POST"))
    return NextResponse.json({ success: false }, { status: 404 });
  try {
    const parsed = isProviders
      ? undefined
      : schema.safeParse(await request.json());
    if (parsed && !parsed.success)
      return NextResponse.json(
        { success: false, error: { message: parsed.error.issues[0].message } },
        { status: 400 },
      );
    const response = await fetch(`${backendUrl()}/auth/${action}`, {
      method: request.method,
      headers: { "Content-Type": "application/json" },
      body: parsed?.success ? JSON.stringify(parsed.data) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    const json = await response.json();
    if (isProviders && json.success)
      json.data = json.data.filter(
        (p: string) =>
          p === "local" ||
          (p === "google" &&
            process.env.GOOGLE_CLIENT_ID &&
            process.env.GOOGLE_CLIENT_SECRET) ||
          (p === "facebook" &&
            process.env.FACEBOOK_CLIENT_ID &&
            process.env.FACEBOOK_CLIENT_SECRET),
      );
    return NextResponse.json(json, { status: response.status });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: {
          message:
            "Blynta authentication is unavailable. Check your connection and try again.",
        },
      },
      { status: 503 },
    );
  }
}
