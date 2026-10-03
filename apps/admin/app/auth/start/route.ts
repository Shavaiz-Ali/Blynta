import { startAuthorization } from "@blynta/auth/server";
export const GET = startAuthorization("blynta-admin", "ADMIN_APP_URL", "/");
