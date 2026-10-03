import { createAdminAuth } from "@blynta/auth/server";
export const { handlers, auth, signIn, signOut } = createAdminAuth();
