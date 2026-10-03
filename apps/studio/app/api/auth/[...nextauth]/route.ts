import { handlers } from "@/auth";
// Auth.js consumes standard Web Requests; the two retained Next versions have nominally distinct NextRequest types.
const get = handlers.GET as (request: Request) => Promise<Response>;
const post = handlers.POST as (request: Request) => Promise<Response>;
export const GET = get;
export const POST = post;
