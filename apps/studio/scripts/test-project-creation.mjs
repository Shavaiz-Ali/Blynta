import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
function transpile(file) {
  return ts.transpileModule(
    fs.readFileSync(new URL(file, import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
}
const dataUrl = (source) =>
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const previous = {
  node: process.env.NODE_ENV,
  main: process.env.MAIN_APP_URL,
  public: process.env.NEXT_PUBLIC_BLYNTA_URL,
};
try {
  process.env.NODE_ENV = "production";
  process.env.MAIN_APP_URL = "https://blynta.example.test";
  process.env.NEXT_PUBLIC_BLYNTA_URL = "http://localhost:3000";
  const source = transpile("../next.config.ts");
  const config = await import(dataUrl(source));
  assert.equal(
    config.default.env.NEXT_PUBLIC_BLYNTA_URL,
    "https://blynta.example.test",
  );
  for (const destination of [
    "",
    "http://localhost:3000",
    "https://localhost:3000",
  ]) {
    process.env.MAIN_APP_URL = destination;
    process.env.NEXT_PUBLIC_BLYNTA_URL = "";
    await assert.rejects(
      import(dataUrl(source + `\n// ${JSON.stringify(destination)}`)),
      /Configure MAIN_APP_URL/,
    );
  }
} finally {
  for (const [key, value] of [
    ["NODE_ENV", previous.node],
    ["MAIN_APP_URL", previous.main],
    ["NEXT_PUBLIC_BLYNTA_URL", previous.public],
  ]) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
const api = dataUrl(transpile("../features/studio/api.ts"));
const { uploadMedia } = await import(
  dataUrl(
    transpile("../features/studio/projects/media.ts").replace(
      /from ['"]\.\.\/api['"]/,
      `from '${api}'`,
    ),
  )
);
const originalFetch = globalThis.fetch;
const file = new File(["test"], "clip.mp4", { type: "video/mp4" });
const asset = { id: "asset-1", status: "ready", kind: "video", duration: 10 };
const response = (data) =>
  new Response(JSON.stringify({ success: true, data }), {
    headers: { "Content-Type": "application/json" },
  });
try {
  let calls = [],
    phases = [];
  globalThis.fetch = async (url, options) => {
    calls.push(url);
    if (url.endsWith("/upload"))
      return response({
        assetId: asset.id,
        uploadUrl: "https://storage.invalid/signed",
      });
    if (url === "https://storage.invalid/signed") {
      assert.equal(options.method, "PUT");
      assert.equal(options.body, file);
      assert.equal(options.headers["Content-Type"], "video/mp4");
      assert.notEqual(options.mode, "no-cors");
      return new Response(null, { status: 200 });
    }
    if (url.endsWith("/complete")) return response({ status: "processing" });
    return response([asset]);
  };
  assert.deepEqual(
    await uploadMedia("project", file, (phase) => phases.push(phase)),
    asset,
  );
  assert.deepEqual(phases, ["uploading", "processing"]);
  assert.equal(calls.length, 4);
  calls = [];
  globalThis.fetch = async (url) => {
    calls.push(url);
    if (url.endsWith("/upload"))
      return response({
        assetId: asset.id,
        uploadUrl: "https://storage.invalid/signed",
      });
    throw new TypeError("Failed to fetch");
  };
  await assert.rejects(
    uploadMedia("project", file),
    /could not reach media storage/,
  );
  assert.equal(
    calls.length,
    2,
    "a blocked PUT must not trigger completion or processing requests",
  );
} finally {
  globalThis.fetch = originalFetch;
}
console.log("Production destination and upload lifecycle regressions passed.");
