import { handlers } from "@/auth";
export async function GET(request: Request) {
  return handlers.GET(request as Parameters<typeof handlers.GET>[0]);
}
export async function POST(request: Request) {
  return handlers.POST(request as Parameters<typeof handlers.POST>[0]);
}
