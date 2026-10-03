import { createProductAuth } from "@blynta/auth/server";
const selected =
  process.env.CENTRAL_AUTH_ENABLED === "true"
    ? createProductAuth("blynta-studio", "STUDIO_APP_URL")
    : await import("./legacy-auth");
export const { handlers, auth, signIn, signOut } = selected;
