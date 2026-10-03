import { startAuthorization } from "@blynta/auth/server";
export const GET = startAuthorization(
  "blynta-studio",
  "STUDIO_APP_URL",
  "/dashboard",
);
