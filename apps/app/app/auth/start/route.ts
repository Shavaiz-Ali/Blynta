import { startAuthorization } from "@blynta/auth/server";
export const GET = startAuthorization(
  "blynta-main",
  "MAIN_APP_URL",
  "/dashboard",
);
