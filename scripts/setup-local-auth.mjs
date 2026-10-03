import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "node:util";

const root = resolve(import.meta.dirname, "..");
function readEnvironment(directory) {
  return Object.assign(
    {},
    ...[".env", ".env.development", ".env.local", ".env.development.local"].map(
      (name) => {
        const path = resolve(root, directory, name);
        return existsSync(path) ? parseEnv(readFileSync(path, "utf8")) : {};
      },
    ),
  );
}
function usable(value) {
  return value && !value.startsWith("replace-with-");
}
function updateEnvironment(relativePath, values) {
  const path = resolve(root, relativePath);
  let source = existsSync(path) ? readFileSync(path, "utf8") : "";
  for (const [key, value] of Object.entries(values)) {
    if (parseEnv(source)[key] === value) continue;
    if (value.includes("'") || /[\r\n]/.test(value))
      throw new Error(
        `Unsupported local value for ${key}; existing configuration is preserved.`,
      );
    const setting = `${key}='${value}'`;
    const line = new RegExp(`^(?:export\\s+)?${key}\\s*=.*$`, "m");
    if (line.test(source)) source = source.replace(line, () => setting);
    else
      source += `${source && !source.endsWith("\n") ? "\n" : ""}${setting}\n`;
  }
  writeFileSync(path, source, { mode: 0o600 });
  console.log(`Configured ${relativePath} (secret values are not printed).`);
}

const backend = readEnvironment("backend");
const identity = readEnvironment("apps/auth");
const products = [
  ["apps/app", "MAIN_APP_URL"],
  ["apps/studio", "STUDIO_APP_URL"],
  ["apps/admin", "ADMIN_APP_URL"],
].map(([directory, originKey]) => ({
  directory,
  originKey,
  environment: readEnvironment(directory),
}));
if (
  process.env.NODE_ENV === "production" ||
  [backend, identity, ...products.map(({ environment }) => environment)].some(
    (environment) => environment.NODE_ENV === "production",
  )
)
  throw new Error("Local Auth setup must not modify production configuration.");
const backendPort = backend.PORT || "5001";
if (!/^\d+$/.test(backendPort)) throw new Error("Invalid local backend PORT");
const backendUrl = `http://localhost:${backendPort}`;
const origins = {
  AUTH_APP_URL: "http://localhost:3003",
  MAIN_APP_URL: "http://localhost:3000",
  STUDIO_APP_URL: "http://localhost:3002",
  ADMIN_APP_URL: "http://localhost:3001",
};
const bridge =
  (usable(backend.SSO_BRIDGE_SECRET) && backend.SSO_BRIDGE_SECRET) ||
  (usable(identity.SSO_BRIDGE_SECRET) && identity.SSO_BRIDGE_SECRET) ||
  randomBytes(32).toString("base64url");
const authSecret =
  usable(identity.AUTH_SECRET) &&
  ![bridge, backend.JWT_SECRET].includes(identity.AUTH_SECRET)
    ? identity.AUTH_SECRET
    : randomBytes(32).toString("base64url");
const identityDefaults = {
  ...origins,
  AUTH_URL: origins.AUTH_APP_URL,
  BACKEND_URL: backendUrl,
  NEXT_PUBLIC_BACKEND_URL: backendUrl,
  NEXT_PUBLIC_API_URL: backendUrl,
};
const formerIdentity = readEnvironment("apps/app");
const providers = Object.fromEntries(
  [
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "FACEBOOK_CLIENT_ID",
    "FACEBOOK_CLIENT_SECRET",
  ]
    .map((key) => [key, identity[key] || formerIdentity[key]])
    .filter(([, value]) => usable(value)),
);
updateEnvironment("apps/auth/.env.local", {
  ...Object.fromEntries(
    Object.entries(identityDefaults).map(([key, fallback]) => [
      key,
      identity[key] || fallback,
    ]),
  ),
  AUTH_SECRET: authSecret,
  SSO_BRIDGE_SECRET: bridge,
  ...providers,
});
const usedSecrets = new Set(
  [authSecret, bridge, backend.JWT_SECRET].filter(Boolean),
);
for (const { directory, originKey, environment } of products) {
  const existingSecret =
    (usable(environment.AUTH_SECRET) && environment.AUTH_SECRET) ||
    (usable(environment.NEXTAUTH_SECRET) && environment.NEXTAUTH_SECRET);
  const productSecret =
    existingSecret && !usedSecrets.has(existingSecret)
      ? existingSecret
      : randomBytes(32).toString("base64url");
  usedSecrets.add(productSecret);
  updateEnvironment(`${directory}/.env.local`, {
    ...Object.fromEntries(
      Object.entries({
        ...origins,
        AUTH_URL: origins[originKey],
        BACKEND_URL: backendUrl,
        NEXT_PUBLIC_BACKEND_URL: backendUrl,
        NEXT_PUBLIC_API_URL: backendUrl,
      }).map(([key, fallback]) => [key, environment[key] || fallback]),
    ),
    AUTH_SECRET: productSecret,
    CENTRAL_AUTH_ENABLED: "true",
  });
}
const clients = {
  "blynta-main": [`${origins.MAIN_APP_URL}/auth/callback`],
  "blynta-studio": [`${origins.STUDIO_APP_URL}/auth/callback`],
  "blynta-admin": [`${origins.ADMIN_APP_URL}/auth/callback`],
};
const allowedOrigins = new Set(
  (backend.ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
);
for (const origin of Object.values(origins)) allowedOrigins.add(origin);
updateEnvironment("backend/.env", {
  ...Object.fromEntries(
    Object.entries(origins).map(([key, fallback]) => [
      key,
      backend[key] || fallback,
    ]),
  ),
  SSO_BRIDGE_SECRET: bridge,
  SSO_CLIENTS: backend.SSO_CLIENTS || JSON.stringify(clients),
  ALLOWED_ORIGINS: [...allowedOrigins].join(","),
  ALLOW_LEGACY_AUTH_TOKENS: "false",
});
console.log(
  "Restart the frontend apps and backend so their new environment settings load.",
);
