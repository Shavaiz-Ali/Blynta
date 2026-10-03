// Centralized, envelope-aware HTTP boundary following Blynta's config convention.
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function accountRequest<T>(
  action: string,
  body?: unknown,
): Promise<T> {
  const response = await fetch(`/api/account/${action}`, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await response.json();
  if (!response.ok || !json.success)
    throw new ApiError(
      json.error?.message || "Unable to connect. Please try again.",
      response.status,
    );
  return json.data as T;
}
