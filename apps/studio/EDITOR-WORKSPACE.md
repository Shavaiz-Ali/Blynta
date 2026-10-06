# Editor workspace redesign

1. **Original problems.** A permanent second rail competed with the tool rail; generic project settings occupied the inspector; the canvas repeated the project name; timeline height was capped by track count. Controls also drifted from the main app through variant choices, local wrappers, and CSS overrides.

2. **Layout.** A 56px shared header sits above one 72px tool rail, a collapsible context panel, a centered preview, and one optional right dock. The timeline spans the full workspace below them.

3. **Component boundaries.** Editor shell, toolbar, media panel, preview, inspector dock, timeline, and skeleton remain Studio features. Generic controls have their implementation in `packages/ui`; compatibility files only re-export them. Product adapters supply account data, routes, and authentication actions.

4. **Second rail.** Removed from both the editor and its loading skeleton. Inspector sections use horizontal shared tabs inside the selected clip's dock. AI has a header entry point.

5. **Inspector.** It appears for a selected clip and closes when selection disappears. Image/video, text, audio, and timing controls follow the selected media kind. Audio controls appear only for applicable clips. Existing track-lock restrictions remain.

6. **Blynta AI.** A 400px default dock replaces the inspector. Closing it restores the selected clip's inspector. Proposal history remains mounted across open/close; applying, discarding, and undoing deterministic proposals retain their existing checks.

7. **Context panel.** Media, Text, Audio, Captions, Transitions, Effects, and Brand use the one rail. The 300px default panel collapses and resizes between 280–340px. Media uses the main app's default segmented tabs, search input, shared upload button, media grid, and shared dropdown menu.

8. **Preview.** Removed the metadata bar above the canvas. Fit respects canvas ratio and media contain/cover/transform state. Canvas ratio, Fit/100%, fullscreen, and existing playback controls sit below the preview. Empty canvases offer the working upload action.

9. **Timeline.** Default height is 36% of viewport height, independent of track count. Existing split, duplicate, delete, snapping, track controls, zoom, and fit actions remain together. Headers have more room; ruler spacing follows zoom; trackless seeking leaves labels readable. Narrow clips hide duration metadata. Videos use available thumbnails rather than load another video element per timeline clip.

10. **Resizing and collapse.** Left panel, inspector (280–340px), AI (380–440px), and timeline have bounded pointer/keyboard resizing. Pointer drags preview CSS geometry and commit workspace state on release. Local storage retains sizes. Smaller desktop widths collapse or overlay docks to preserve the preview and timeline.

11. **Keyboard.** Space, S, Delete/Backspace, Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, Escape, and Ctrl/Cmd+K remain available. Inputs, textareas, contenteditable, menus, dialogs, sliders, separators, and composition events are excluded from global editing shortcuts.

12. **State.** Project document/history and the existing serialized save session remain separate from workspace settings. Resizing and panel visibility do not enqueue project autosaves. Playback has an independent transient store.

13. **Performance.** Only preview/transport subscribers receive playback ticks; the project context does not update on each tick. Timeline clips are memoized; clip menus subscribe to playback only while open. Panel drag previews avoid rebuilding the entire editor on every pointer move. Geometry observers still update the canvas when its size changes.

14. **Loading, empty, and errors.** The skeleton follows the new regions and timeline allocation. No selection collapses the inspector. Existing media/upload errors remain visible. Project-load errors now include a retry action.

15. **Files.** Main implementation: `features/studio/editor/{components,hooks,preview,media,inspector,timeline,stores/playback-clock.ts}`; geometry: `app/editor-layout.css`, `app/studio.css`; shared controls: `packages/ui/src/components` and relevant primitives/index. Both apps re-export the same theme toggle. `eslint.config.mjs` rejects Studio feature imports from local App controls. `packages/ui/README.md` documents ownership. Regression suites live in `scripts/test-editor.mjs` and `scripts/test-workspace.mjs`.

16. **Preserved limits.** Brand remains unavailable; transitions/effects expose only existing fade/transform capabilities. No fabricated waveforms, animations, or unsupported editing controls were added. AI proposals, uploads, transcription, and final video rendering still depend on their existing services. Browser tests stub API transport and do not prove a live cloud render or upload. The editor remains desktop-first.

17. **Validation.** Studio production build passes. Editor regression tests cover history, trims/splits, captions, AI undo, serialized autosave/conflicts, and the playback clock. Browser checks cover 2560, 1920, 1600, 1440, 1280, and 1000px layouts; selection, AI replacement/restoration and apply/undo; playback, split/delete/undo; aspect ratio/source fit; local resizing persistence without autosave; input shortcut protection; and export UI. Studio and shared-package lint pass. Studio, shared-package, and main-app type checks pass. The changed main-app theme-toggle file also passes targeted lint. Browser checks complete successfully and clean up their isolated server.
