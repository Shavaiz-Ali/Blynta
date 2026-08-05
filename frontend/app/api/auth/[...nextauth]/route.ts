/**
 * app/api/auth/[...nextauth]/route.ts
 *
 * Thin handler that wires Auth.js's built-in HTTP handlers into the
 * Next.js App Router. All logic lives in auth.ts — this file just re-exports.
 */

import { handlers } from "@/auth";

export const { GET, POST } = handlers;
