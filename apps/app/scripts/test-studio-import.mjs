import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { QueryClient, QueryObserver } from "@tanstack/react-query";

async function sourceModule(path) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  });
  return import(
    `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
  );
}
const { studioEditorUrl } = await sourceModule(
  "../features/jobs/studio-navigation.ts",
);
const { cachedClipJob } = await sourceModule(
  "../features/jobs/clip-details-cache.ts",
);
const project = "6abe4de08c39dc00dddedd54";
assert.equal(
  studioEditorUrl(project, "https://studio.example.test/base"),
  `https://studio.example.test/editor/${project}`,
);
assert.equal(
  studioEditorUrl(project, "http://localhost:3002"),
  `http://localhost:3002/editor/${project}`,
);
for (const origin of [
  undefined,
  "javascript:alert(1)",
  "https://user:password@example.test",
]) {
  assert.throws(() => studioEditorUrl(project, origin));
}
assert.throws(() =>
  studioEditorUrl("../../foreign", "https://studio.example.test"),
);

const client = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});
const job = {
  id: "owned-job",
  _id: "owned-job",
  clips: [{ _id: project }],
  updatedAt: new Date().toISOString(),
};
client.setQueryData(["jobs", "list", { page: 1 }], { jobs: [job] });
assert.equal(cachedClipJob(client, job.id, project), job);
assert.equal(cachedClipJob(client, "other-job", project), undefined);
assert.equal(cachedClipJob(client, job.id, "missing"), undefined);
let requests = 0;
let resolveFetch;
const fetched = new Promise((resolve) => {
  resolveFetch = resolve;
});
const options = {
  queryKey: ["jobs", "detail", job.id],
  queryFn: () => {
    requests++;
    return fetched;
  },
  placeholderData: () => cachedClipJob(client, job.id, project),
  staleTime: 10_000,
};
const first = new QueryObserver(client, options);
const second = new QueryObserver(client, options);
const stopFirst = first.subscribe(() => {});
const stopSecond = second.subscribe(() => {});
assert.equal(first.getCurrentResult().data, job);
assert.equal(first.getCurrentResult().isLoading, false);
assert.equal(requests, 1, "two consumers must share one detail request");
resolveFetch(job);
await fetched;
await new Promise((resolve) => setTimeout(resolve, 0));
stopFirst();
stopSecond();
const cached = new QueryObserver(client, options);
const stopCached = cached.subscribe(() => {});
assert.equal(cached.getCurrentResult().isLoading, false);
assert.equal(requests, 1, "fresh detail cache must avoid another request");
stopCached();
client.clear();
console.log(
  "Studio destination validation and query cache regressions passed.",
);
