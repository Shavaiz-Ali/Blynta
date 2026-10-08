/** One browser-wide state for all product session watchers and transports. */
export function createSessionState() {
  let phase: "active" | "expired" | "authorizing" = "active";
  let returnTo = "/dashboard";
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((listener) => listener());
  return {
    getSnapshot: () => phase,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    expire(destination: string) {
      if (phase !== "active") return;
      returnTo = destination;
      phase = "expired";
      emit();
    },
    beginAuthorization() {
      if (phase === "authorizing") return null;
      phase = "authorizing";
      emit();
      return "/auth/start?returnTo=" + encodeURIComponent(returnTo);
    },
  };
}

export const productSessionState = createSessionState();

export const productLogoutState = { inProgress: false };
