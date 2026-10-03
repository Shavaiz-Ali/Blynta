export const blyntaUrl =
  process.env.NEXT_PUBLIC_BLYNTA_URL || "http://localhost:3000";
export function backendUrl() {
  const url = process.env.NEXT_PUBLIC_BACKEND_URL;
  if (!url)
    throw new Error("Set NEXT_PUBLIC_BACKEND_URL to the existing Blynta API.");
  return url.replace(/\/$/, "");
}
