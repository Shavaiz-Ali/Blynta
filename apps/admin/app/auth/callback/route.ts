import { finishAuthorization } from "@blynta/auth/server";
import { signIn } from "@/auth";
export const GET = finishAuthorization("blynta-admin", signIn);
