import { getEnabledProviders } from "@/features/auth/api";

export async function GET() {
  const enabled = await getEnabledProviders({ revalidate: 0, debug: false });
  const configured = enabled.filter(
    (provider) =>
      provider === "local" ||
      (provider === "google" &&
        process.env.GOOGLE_CLIENT_ID &&
        process.env.GOOGLE_CLIENT_SECRET) ||
      (provider === "facebook" &&
        process.env.FACEBOOK_CLIENT_ID &&
        process.env.FACEBOOK_CLIENT_SECRET),
  );
  return Response.json(configured, {
    headers: { "Cache-Control": "no-store" },
  });
}
