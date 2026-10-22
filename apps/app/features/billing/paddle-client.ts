import {
  initializePaddle,
  type PaddleEventData,
  type Paddle,
  type Environments,
} from "@paddle/paddle-js";

export function checkoutEnvironment(
  token: string | undefined,
  server: string,
  configured?: string,
): Environments {
  if (!token)
    throw new Error(
      "Checkout is unavailable: NEXT_PUBLIC_PADDLE_CLIENT_TOKEN is missing.",
    );
  const environment = token.startsWith("test_")
    ? "sandbox"
    : token.startsWith("live_")
      ? "production"
      : undefined;
  if (!environment)
    throw new Error(
      "Checkout requires a Paddle client-side token (test_ or live_), never an API key or price ID.",
    );
  if (server !== "sandbox" && server !== "production")
    throw new Error("The server Paddle environment is invalid.");
  if (environment !== server || (configured && configured !== environment))
    throw new Error(
      "Paddle environment mismatch. Use matching backend credentials, prices and a client-side token.",
    );
  return environment;
}

export function createPaddleLoader(
  initialize = initializePaddle,
  timeoutMs = 15000,
) {
  let pending: Promise<Paddle> | undefined;
  let configuration: string | undefined;
  return (
    token: string,
    environment: Environments,
    eventCallback: (event: PaddleEventData) => void,
  ) => {
    const key = `${environment}:${token}`;
    if (configuration && configuration !== key)
      return Promise.reject(
        new Error("Checkout configuration changed. Reload the billing page."),
      );
    if (!pending) {
      configuration = key;
      let timer: ReturnType<typeof setTimeout>;
      pending = Promise.race([
        Promise.resolve().then(() =>
          initialize({ token, environment, eventCallback }),
        ),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error("Paddle.js load timed out")),
            timeoutMs,
          );
        }),
      ])
        .then((paddle) => {
          if (!paddle)
            throw new Error(
              "Paddle.js did not initialize. Check script blocking, CSP and the configured client token.",
            );
          return paddle;
        })
        .catch(() => {
          pending = undefined;
          configuration = undefined;
          throw new Error(
            "Could not load Paddle checkout. Check your connection or content blocker, then retry.",
          );
        })
        .finally(() => clearTimeout(timer));
    }
    return pending;
  };
}
