// Reproducible source inventory. Never reads .env files or live databases.
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const tracked = execFileSync(
  "git",
  ["ls-files", "backend/src", "backend/scripts", "apps", "packages", "scripts"],
  { cwd: root, encoding: "utf8" },
);
const added = execFileSync(
  "git",
  [
    "ls-files",
    "--others",
    "--exclude-standard",
    "backend/src",
    "backend/scripts",
    "apps",
    "packages",
    "scripts",
  ],
  { cwd: root, encoding: "utf8" },
);
const files = [
  ...new Set(
    (tracked + "\n" + added)
      .trim()
      .split(/\r?\n/)
      .filter(
        (file) =>
          /\.(?:ts|tsx|cjs|mjs)$/.test(file) &&
          !file.includes("/node_modules/") &&
          !file.includes("/generated/"),
      ),
  ),
];
const categories = [
  [
    "provider-url",
    /https:\/\/(?:generativelanguage\.googleapis\.com|api\.groq\.com|api\.openai\.com)[^\s'"`]*/g,
    "Approved endpoint policy/adapter configuration; registered AI endpoints belong in existing provider records.",
  ],
  [
    "http-status",
    /(?:status|statusCode|httpStatusCode)\s*(?:===|!==|>=|<=)\s*(?:400|401|403|404|409|429|500|502|503)\b/g,
    "Framework HttpStatus on backend; protocol constant or transport boundary on frontend.",
  ],
  [
    "ai-task",
    /['"](?:highlight_detection|edit_planning|edit_refinement)['"]/g,
    "Shared public contracts; fixtures and persisted baseline assertions remain literal intentionally.",
  ],
  [
    "ai-error",
    /['"]AI_[A-Z_]+['"]/g,
    "Shared error codes; fixtures and third-party SDK error class names are intentional.",
  ],
  [
    "queue-identifier",
    /(?:InjectQueue|Processor)\(['"][^'"]+['"]/g,
    "Domain queue constants; legacy Studio references stay compatible.",
  ],
  [
    "pagination",
    /(?:limit|pageSize):?\s*(?:number\s*=\s*)?(?:25|20|100)\b/g,
    "Domain pagination policy; different public API defaults must be preserved.",
  ],
  [
    "operational-timeout",
    /(?:timeout|timeoutMs|lockDuration|stalledInterval)[:(]\s*(?:15000|30000|60000|60_000|30_000)\b/g,
    "Named operational policy or validated environment configuration, not database reads.",
  ],
  [
    "pipeline-stage",
    /['"](?:pending|transcribing|detecting_highlights|cutting_clips|cancelling|cancelled)['"]/g,
    "Shared persisted stage contract; UI copy and test expectations may remain explicit.",
  ],
  [
    "provider-model-id",
    /['"](?:gemini-|gpt-|claude-)[a-zA-Z0-9.-]+['"]/g,
    "Registry model records; named legacy compatibility defaults or deterministic test fixtures.",
  ],
];
const findings = [];
for (const file of files) {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  for (const [category, pattern, destination] of categories) {
    pattern.lastIndex = 0;
    for (const match of source.matchAll(pattern))
      findings.push({
        file,
        line: source.slice(0, match.index).split("\n").length,
        value: match[0],
        category,
        destination,
        scope:
          file.startsWith("apps/studio/") ||
          file.startsWith("backend/src/studio/")
            ? "legacy-studio-read-only"
            : /(?:\.spec\.ts|\/test|\/tests|fixture)/.test(file)
              ? "intentional-test-fixture"
              : "production-source",
      });
  }
}
const summary = Object.fromEntries(
  categories.map(([category]) => [
    category,
    findings.filter((f) => f.category === category).length,
  ]),
);
const output = path.join(root, "docs/hardcoding-inventory.json");
fs.writeFileSync(
  output,
  JSON.stringify({ filesInspected: files.length, summary, findings }, null, 2) +
    "\n",
);
console.log(
  JSON.stringify({
    filesInspected: files.length,
    summary,
    output: "docs/hardcoding-inventory.json",
  }),
);
