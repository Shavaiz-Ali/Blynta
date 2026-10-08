import { auth } from "@/auth";
import { backendUrl } from "@/config/env";
import { NextResponse } from "next/server";
export async function sessionCheck() {
  const session = await auth();
  if (session?.authError) return NextResponse.json({}, { status: 503 });
  if (!session?.accessToken) return NextResponse.json({}, { status: 401 });
  try {
    const response = await fetch(`${backendUrl()}/users/me`, {
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    return NextResponse.json(
      {},
      {
        status: response.ok ? 200 : response.status === 401 ? 401 : 503,
      },
    );
  } catch {
    return NextResponse.json({}, { status: 503 });
  }
}
