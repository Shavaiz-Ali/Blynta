import axios from "axios";

export function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const payload = error.response?.data as
      | { message?: string; error?: { message?: string } }
      | undefined;
    return payload?.error?.message || payload?.message || error.message || fallback;
  }

  return error instanceof Error && error.message ? error.message : fallback;
}
