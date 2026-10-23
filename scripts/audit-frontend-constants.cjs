/* Read-only source inventory. Candidates require domain review, not blanket replacement. */
const fs = require("node:fs");
const path = require("node:path");
const cp = require("node:child_process");
const root = path.resolve(__dirname, "..");
const ts = require(
  require.resolve("typescript", { paths: [path.join(root, "apps/app")] }),
);
const slash = (value) => value.replaceAll("\\", "/");
const files = [];
function walk(dir) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    if (
      [
        "node_modules",
        ".next",
        ".turbo",
        "generated",
        "dist",
        "scripts",
      ].includes(item.name) ||
      item.name.startsWith(".")
    )
      continue;
    const full = path.join(dir, item.name);
    if (item.isDirectory()) walk(full);
    else if (
      /\.[cm]?[jt]sx?$/.test(item.name) &&
      !/\.(test|spec|d)\./.test(item.name)
    )
      files.push(slash(path.relative(root, full)));
  }
}
walk(path.join(root, "apps"));
walk(path.join(root, "packages"));
const groups = {
  plans: ["free", "pro", "business"],
  roles: ["user", "admin"],
  statuses: [
    "pending",
    "completed",
    "failed",
    "cancelling",
    "cancelled",
    "active",
    "trialing",
    "past_due",
    "canceled",
    "paused",
    "paid",
    "billed",
    "draft",
    "ready",
  ],
  creditTransactions: [
    "opening",
    "grant",
    "reserve",
    "charge",
    "release",
    "refund",
    "adjustment",
  ],
  stages: [
    "transcribing",
    "detecting_highlights",
    "cutting_clips",
    "preparing_assets",
    "compiling_plan",
    "encoding",
    "verifying",
    "uploading_preview",
    "finalizing",
  ],
  media: ["video", "audio", "image", "text"],
  notificationAndActivity: [
    "auth",
    "job",
    "billing",
    "credit",
    "referral",
    "account",
    "system",
    "unread",
    "read",
    "info",
    "success",
    "warning",
    "error",
  ],
};
const inventory = {},
  controls = [],
  keys = [],
  unions = new Map(),
  sources = new Map();
function parse(file, source, collect = true) {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const imports = [];
  function visit(node) {
    const location = () => ({
      file,
      line: ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1,
    });
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier))
        imports.push(node.moduleSpecifier.text);
    }
    if (
      collect &&
      (ts.isStringLiteral(node) ||
        ts.isNoSubstitutionTemplateLiteral(node) ||
        ts.isTemplateExpression(node))
    ) {
      const value = ts.isTemplateExpression(node)
        ? node.getText(ast).slice(1, -1)
        : node.text;
      const categories = Object.entries(groups)
        .filter(([, values]) => values.includes(value))
        .map(([name]) => name);
      if (/^\/[a-zA-Z][^\s]*$/.test(value))
        categories.push("routesAndEndpoints");
      if (/blynta[:_-]/.test(value)) categories.push("storageAndFeatureKeys");
      for (const group of categories) {
        const entry = (inventory[group] ||= {});
        (entry[value] ||= []).push(location());
      }
    }
    if (collect && ts.isNumericLiteral(node)) {
      let parent = node.parent;
      for (
        let depth = 0;
        parent && depth < 5;
        depth++, parent = parent.parent
      ) {
        if (
          (ts.isVariableDeclaration(parent) ||
            ts.isPropertyAssignment(parent)) &&
          /credit|allowance|limit|page.?size|pricing|budget|reservation/i.test(
            parent.name.getText(ast),
          )
        ) {
          const values = (inventory.businessNumberCandidates ||= {});
          (values[node.text] ||= []).push(location());
          break;
        }
      }
    }
    if (
      collect &&
      ts.isPropertyAssignment(node) &&
      node.name.getText(ast) === "queryKey"
    )
      keys.push({ ...location(), expression: node.initializer.getText(ast) });
    if (
      collect &&
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node))
    ) {
      const tag = node.tagName.getText(ast);
      if (["select", "table", "input"].includes(tag))
        controls.push({
          ...location(),
          tag,
          attributes: node.attributes.getText(ast),
        });
    }
    if (
      collect &&
      ts.isTypeAliasDeclaration(node) &&
      ts.isUnionTypeNode(node.type) &&
      node.type.types.every(
        (t) => ts.isLiteralTypeNode(t) && ts.isStringLiteral(t.literal),
      )
    ) {
      const values = node.type.types
        .map((t) => t.literal.text)
        .sort()
        .join("|");
      const found = unions.get(values) || [];
      found.push({ ...location(), name: node.name.text });
      unions.set(values, found);
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return imports;
}
for (const file of files)
  sources.set(file, fs.readFileSync(path.join(root, file), "utf8"));
const imports = new Map(
  files.map((file) => [file, parse(file, sources.get(file))]),
);
function resolve(from, target, known) {
  let base;
  if (target.startsWith("."))
    base = slash(
      path.posix.normalize(path.posix.join(path.posix.dirname(from), target)),
    );
  else if (target.startsWith("@/"))
    base = from.split("/").slice(0, 2).join("/") + "/" + target.slice(2);
  else {
    const match = /^@blynta\/(types|auth|ui|api-client)(?:\/(.*))?$/.exec(
      target,
    );
    if (!match) return;
    const suffix = (match[2] || "index")
      .replace(/^components\//, "components/")
      .replace(/^primitives\//, "primitives/");
    base = `packages/${match[1]}/src/${suffix}`;
  }
  return [
    base,
    base + ".ts",
    base + ".tsx",
    base + ".js",
    base + "/index.ts",
    base + "/index.tsx",
  ].find((file) => known.has(file));
}
function cycles(map) {
  const known = new Set(map.keys()),
    edges = new Map(
      [...map].map(([f, refs]) => [
        f,
        refs.map((ref) => resolve(f, ref, known)).filter(Boolean),
      ]),
    );
  let sequence = 0;
  const ids = new Map(),
    lows = new Map(),
    stack = [],
    active = new Set(),
    found = [];
  function visit(file) {
    ids.set(file, sequence);
    lows.set(file, sequence++);
    stack.push(file);
    active.add(file);
    for (const next of edges.get(file)) {
      if (!ids.has(next)) {
        visit(next);
        lows.set(file, Math.min(lows.get(file), lows.get(next)));
      } else if (active.has(next))
        lows.set(file, Math.min(lows.get(file), ids.get(next)));
    }
    if (ids.get(file) === lows.get(file)) {
      const component = [];
      let item;
      do {
        item = stack.pop();
        active.delete(item);
        component.push(item);
      } while (item !== file);
      if (component.length > 1 || edges.get(file).includes(file))
        found.push(component.sort());
    }
  }
  for (const file of map.keys()) if (!ids.has(file)) visit(file);
  return found;
}
const tracked = new Set(
  cp
    .execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" })
    .trim()
    .split(/\r?\n/),
);
const changed = new Set(
  cp
    .execFileSync("git", ["diff", "HEAD", "--name-only"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
    .trim()
    .split(/\r?\n/),
);
const previous = new Map();
for (const [file, refs] of imports)
  if (tracked.has(file))
    previous.set(
      file,
      changed.has(file)
        ? parse(
            file,
            cp.execFileSync("git", ["show", "HEAD:" + file], {
              cwd: root,
              encoding: "utf8",
            }),
            false,
          )
        : refs,
    );
const baselineCycles = cycles(previous),
  currentCycles = cycles(imports);
const introducedCycles = currentCycles.filter(
  (component) =>
    !baselineCycles.some(
      (old) =>
        component.length === old.length &&
        component.every((f) => old.includes(f)),
    ),
);
const report = {
  scannedFiles: files.length,
  bySurface: Object.fromEntries(
    [...new Set(files.map((f) => f.split("/").slice(0, 2).join("/")))].map(
      (surface) => [
        surface,
        files.filter((f) => f.startsWith(surface + "/")).length,
      ],
    ),
  ),
  inventory,
  queryKeys: keys,
  rawControls: controls,
  repeatedStringUnions: [...unions]
    .filter(([, occurrences]) => occurrences.length > 1)
    .map(([values, occurrences]) => ({ values, occurrences })),
  baselineCycles,
  currentCycles,
  introducedCycles,
};
const output = path.join(root, ".test-results/frontend-constants-audit.json");
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
console.log(
  JSON.stringify({
    report: slash(path.relative(root, output)),
    scannedFiles: report.scannedFiles,
    bySurface: report.bySurface,
    candidateLiteralOccurrences: Object.fromEntries(
      Object.entries(inventory).map(([group, values]) => [
        group,
        Object.values(values).reduce((n, found) => n + found.length, 0),
      ]),
    ),
    rawControls: controls.length,
    repeatedStringUnions: report.repeatedStringUnions.length,
    baselineCycles: baselineCycles.length,
    currentCycles: currentCycles.length,
    introducedCycles: introducedCycles.length,
  }),
);
if (introducedCycles.length) process.exitCode = 1;
