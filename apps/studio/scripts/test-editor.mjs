import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import ts from "typescript";
import { fileURLToPath, pathToFileURL } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Compile only pure editor modules into an isolated temporary directory.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "blynta-editor-test-"));
const modules = [
  "features/studio/editor/stores/playback-clock.ts",
  "features/studio/projects/mock-data.ts",
  "features/studio/editor/stores/editor-store.ts",
  "features/studio/projects/document.ts",
  "features/studio/editor/stores/save-session.ts",
  "features/studio/api.ts",
  "features/auth/central-auth.ts",
];
try {
  for (const file of modules) {
    const result = ts.transpileModule(
      fs.readFileSync(path.join(__dirname, "..", file), "utf8"),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
      },
    );
    const target = path.join(tmp, file.replace(/\.ts$/, ".js"));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, result.outputText);
  }
  const { PlaybackClock } = (
    await import(
      pathToFileURL(
        path.join(tmp, "features/studio/editor/stores/playback-clock.js"),
      ).href
    )
  ).default;
  const clock = new PlaybackClock();
  let notifications = 0;
  const unsubscribe = clock.subscribe(() => notifications++);
  clock.setDuration(0.25);
  clock.seek(99);
  assert.equal(clock.getSnapshot().playhead, 0.25);
  clock.toggle();
  assert.equal(clock.getSnapshot().playhead, 0);
  assert.equal(clock.getSnapshot().playing, true);
  await new Promise((resolve) => setTimeout(resolve, 400));
  assert.deepEqual(clock.getSnapshot(), { playhead: 0.25, playing: false });
  clock.setDuration(10);
  clock.seek(4);
  clock.toggle();
  clock.stop();
  const stopped = clock.getSnapshot();
  await new Promise((resolve) => setTimeout(resolve, 150));
  assert.equal(clock.getSnapshot(), stopped, "stopped playback must not tick");
  clock.setDuration(2);
  assert.equal(clock.getSnapshot().playhead, 2);
  unsubscribe();
  const before = notifications;
  clock.seek(0);
  assert.equal(
    notifications,
    before,
    "unsubscribed panels must not receive playback updates",
  );
  const { mockProjects } = (
    await import(
      pathToFileURL(path.join(tmp, "features/studio/projects/mock-data.js"))
        .href
    )
  ).default;
  const { editorReducer, patchClip, splitClip, applyAIActions } = (
    await import(
      pathToFileURL(
        path.join(tmp, "features/studio/editor/stores/editor-store.js"),
      ).href
    )
  ).default;
  const doc = mockProjects()[0];
  const history = { past: [], present: doc, future: [] };
  const edit = editorReducer(history, {
    type: "edit",
    apply: (d) => patchClip(d, "v1", { volume: 40 }),
  });
  assert.equal(edit.present.clips[0].volume, 40);
  assert.equal(
    doc.clips[0].volume,
    80,
    "editing must preserve original document",
  );
  const undone = editorReducer(edit, { type: "undo" });
  assert.equal(undone.present, doc);
  assert.equal(editorReducer(undone, { type: "redo" }).present, edit.present);
  assert.equal(
    editorReducer(history, { type: "undo" }),
    history,
    "empty undo is a no-op",
  );
  assert.equal(
    editorReducer(history, { type: "edit", apply: (d) => d }),
    history,
    "no-op edits don't consume history",
  );
  const split = splitClip(
    patchClip(doc, "v1", { speed: 2, offset: 3 }),
    "v1",
    10,
  );
  const pieces = split.clips.filter((c) => c.assetId === "main");
  assert.equal(pieces.length, 2);
  assert.equal(
    pieces[0].duration + pieces[1].duration,
    22.5,
    "Speed changes cannot exceed the available source duration",
  );
  assert.equal(
    pieces[1].offset,
    23,
    "split must retain source offset at playback speed",
  );
  assert.equal(
    splitClip(doc, "v1", 0),
    doc,
    "boundary split must not create zero-length clips",
  );
  const lockedDoc = {
    ...doc,
    tracks: doc.tracks.map((t) =>
      t.id === "video" ? { ...t, locked: true } : t,
    ),
  };
  assert.equal(
    patchClip(lockedDoc, "v1", { start: 10 }),
    lockedDoc,
    "locked track blocks movement and property edits",
  );
  assert.equal(
    splitClip(lockedDoc, "v1", 10),
    lockedDoc,
    "locked track blocks splitting",
  );
  assert.throws(
    () =>
      applyAIActions(lockedDoc, [
        { type: "ratio", ratio: "9:16" },
        { type: "trim", seconds: 5 },
      ]),
    /locked track/,
    "AI proposal is atomic when a track is locked",
  );
  assert.equal(lockedDoc.ratio, "16:9");
  const trimmed = applyAIActions(doc, [{ type: "trim", seconds: 5 }]);
  assert.equal(trimmed.clips.find((c) => c.id === "v1").duration, 27);
  assert.equal(trimmed.clips.find((c) => c.id === "v1").offset, 5);
  assert.equal(
    trimmed.clips.find((c) => c.id === "v2").start,
    11,
    "trim must keep tracks in sync",
  );
  assert.equal(trimmed.clips.find((c) => c.id === "t1").duration, 5);
  assert.throws(
    () => applyAIActions(doc, [{ type: "captions" }]),
    /No transcript/,
  );
  const captions = applyAIActions(doc, [
    {
      type: "captions",
      segments: [{ start: 0.5, end: 2, text: "Actual transcript words" }],
    },
  ]);
  assert.equal(captions.clips.at(-1).name, "Actual transcript words");
  assert.equal(captions.clips.at(-1).start, 0.5);
  assert.equal(captions.clips.at(-1).duration, 1.5);
  let aiHistory = editorReducer(
    { past: [], present: doc, future: [] },
    {
      type: "edit",
      apply: (d) =>
        applyAIActions(d, [
          { type: "ratio", ratio: "9:16" },
          { type: "trim", seconds: 5 },
        ]),
    },
  );
  assert.equal(aiHistory.past.length, 1);
  assert.equal(editorReducer(aiHistory, { type: "undo" }).present, doc);
  assert.throws(
    () =>
      applyAIActions(doc, [{ type: "trim", seconds: 900, targetClipId: "v1" }]),
    /duration/,
  );
  const { SaveSession } = (
    await import(
      pathToFileURL(
        path.join(tmp, "features/studio/editor/stores/save-session.js"),
      ).href
    )
  ).default;
  const writes = [];
  let release;
  const save = new SaveSession(doc, 0, async (revision, document) => {
    writes.push({ revision, document });
    if (writes.length === 1)
      await new Promise((resolve) => {
        release = resolve;
      });
    return { revision: revision + 1 };
  });
  const first = { ...doc, name: "First edit" },
    latest = { ...doc, name: "Latest edit" };
  save.enqueue(first);
  const pending = save.flush();
  save.enqueue(latest);
  release();
  assert.equal(await pending, 2);
  assert.equal(writes[0].revision, 0);
  assert.equal(writes[1].revision, 1);
  assert.equal(writes[1].document, latest);
  assert.equal(save.dirty, false);
  const conflict = new SaveSession(doc, 1, async () => {
    throw new Error("Project changed");
  });
  conflict.enqueue(first);
  await assert.rejects(conflict.flush(), /Project changed/);
  assert.equal(conflict.dirty, true);
  assert.match(conflict.status, /Save failed/);
  const { persistentDocument } = (
    await import(pathToFileURL(path.join(tmp, "features/studio/api.js")).href)
  ).default;
  assert.equal(
    persistentDocument({
      ...doc,
      assets: [
        {
          ...doc.assets[0],
          src: "https://signed-secret",
          thumbnail: "https://signed-thumb",
        },
      ],
    }).assets[0].src,
    undefined,
  );
  const { safeStudioReturnTo } = (
    await import(
      pathToFileURL(path.join(tmp, "features/auth/central-auth.js")).href
    )
  ).default;
  const origin = "https://studio.blynta.com";
  assert.equal(
    safeStudioReturnTo("/editor/project?tab=media", origin),
    `${origin}/editor/project?tab=media`,
  );
  for (const unsafe of [
    "https://untrusted.example/login",
    "//untrusted.example",
    "javascript:alert(1)",
    "/\\untrusted.example",
    "https://studio.blynta.com.untrusted.example/",
  ])
    assert.equal(safeStudioReturnTo(unsafe, origin), `${origin}/dashboard`);
  console.log(
    "Passed editor and auth checks: history, immutability, splitting, synchronized trims, real transcript captions, grouped AI undo, serialized autosave, conflicts and URL stripping.",
  );
} finally {
  // The path is created directly by mkdtemp and cannot point at the workspace.
  if (
    path.dirname(path.resolve(tmp)) !== path.resolve(os.tmpdir()) ||
    !path.basename(tmp).startsWith("blynta-editor-test-")
  )
    throw new Error("Unexpected test cleanup path");
  fs.rmSync(tmp, { recursive: true, force: true });
}
