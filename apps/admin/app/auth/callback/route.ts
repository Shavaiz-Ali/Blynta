export function GET() {
  return new Response("Admin requires a separate credentials sign-in.", {
    status: 400,
    headers: { "Cache-Control": "no-store" },
  });
}
