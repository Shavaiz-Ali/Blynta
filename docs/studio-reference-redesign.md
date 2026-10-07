# Blynta Studio reference-layout redesign

This report describes the initial macro-layout pass. The subsequent internal UX refinement is documented in [Studio editor UX refinement](studio-ux-refinement.md).

The attached screenshot supplies workspace structure; Blynta's existing semantic theme, fonts, logo, icons, and real project data supply the identity and content.

## Implementation report

1. **Existing architecture:** Studio already had functional media tools, preview, AI proposals, inspector, autosave, export, and a multitrack timeline. The root was a grid with the rail and toolbar as siblings, and a nested stage grid containing preview and the right dock. Geometry was distributed across existing stylesheets.
2. **Structural differences:** The main editor area was not an explicit sibling of the rail; legacy geometry and browser assertions described a viewport-wide timeline. There was no preview toolbar, and loading used a spinner. Default preview transport also appeared in the timeline toolbar.
3. **New hierarchy:** `EditorWorkspace → EditorToolRail + MainEditorArea → EditorToolbar + EditorBody + status`. `EditorBody → UpperWorkspace + vertical resize handle + Timeline`. `UpperWorkspace → ProjectTools + PreviewCanvas + EditorTaskPanel`, with horizontal resize handles positioned in panel gutters.
4. **Navigation:** The 72 px desktop rail stays beside the header, upper workspace, timeline, and status. Existing Media, Text, Audio, Captions, Transitions, Effects, Brand, logo navigation, and theme control remain. It uses a 56 px rail on narrow screens.
5. **Header:** A compact 48 px desktop header starts after the rail. Existing project-name editing, save status/retry, panel toggles, AI, export, settings, and account controls remain. It wraps on small viewports. No unsupported Share action was invented.
6. **Project tools:** A 280 px initial panel with category-specific existing tools, library/upload/generated tabs, search and type filters, uploads, and compact media rows. Its resize range is 260–330 px.
7. **Preview:** The largest upper region contains an actual working ratio/zoom toolbar, a centered container-sized canvas, a seek bar, and shared playback controls. Project aspect ratio stays independent from source `contain`/crop and clip transforms. Fullscreen, volume, frame stepping, media drops, and final-frame behavior remain.
8. **Right workspace:** One 300 px initial panel switches between Blynta AI, selected-clip inspection, and project settings. AI opens initially on desktop; selecting a clip shows its inspector. Closing AI retains proposal history. Both right-panel modes resize within 280–360 px. There is no second vertical tool rail.
9. **Timeline placement:** The timeline is inside MainEditorArea, below all three upper panels. Its left edge follows the navigation rail and gutter, never passing under the rail.
10. **Track controls:** A sticky, dedicated 148 px desktop column contains real track labels and existing lock, visibility, and mute actions. Headers and lanes share 58 px row heights and the same scroll surface. Mobile controls use a 120 px column.
11. **Timeline improvements:** A compact edit/zoom toolbar, zoom-aware ruler intervals, existing playhead/seek support, thumbnail strips, clip selection, trimming, movement, split, delete, snapping, undo/redo, and track filtering remain. The initial 64 px/second zoom improves short-project density. Transport is consolidated under the preview.
12. **Resize/collapse:** Existing shared pointer/keyboard resize handles resize both side panels and the timeline. Dimensions commit on release and are stored under `blynta-studio:workspace:v7`; they do not enter the saved project. The version change resets prior layout preferences once. Side panels collapse to expand preview. Below desktop thresholds they open as exclusive contextual overlays; the permanent rail remains.
13. **Preserved behavior:** Project query/loading, naming, revision-based autosave, media operations, AI propose/apply/discard/undo, inspector fields, source fit, timeline edits/history, shortcuts, and export remain connected to existing implementations. Shortcuts still ignore text fields, editable content, dialogs, sliders, and resize handles.
14. **Shared UI reused:** AppButton, AppInput, AppTabs, AppSidebarItem, AppTooltip, AppScrollArea, AppResizeHandle, AppSelect, AppSlider, AppSkeleton, AppMediaCard, AppDropdown, AppDialog, AppFileInput, AppPopover, and shared PlayerControls. Existing AI also uses AppTextarea.
15. **Studio components:** Refactored existing EditorWorkspace/EditorShell, EditorToolRail, MediaPanel, EditorToolbar, PreviewCanvas, EditorTaskPanel, Timeline, MediaItem, and EditorLoading. Added the Studio-specific EditorUnavailable state.
16. **Generic duplicates:** No new generic primitives or dependencies were introduced, and none needed removal in the edited components.
17. **Tailwind:** All new workspace layout, panel boundaries, responsive sizing, loading/error state styling, and compact media-row styling use Tailwind with established semantic tokens.
18. **Custom CSS:** No stylesheet or style block was added or edited. Existing CSS still supplies pre-existing clip/trim visuals and AI/inspector internals. Runtime CSS variables remain for drag dimensions; calculated canvas and clip geometry remains dynamic. This change does not migrate the entire legacy styling system.
19. **API:** No transport was added or changed. Existing `studioApi` calls remain. Audit found Studio already uses a same-origin Studio request wrapper; it does not import `@blynta/api-client` directly. The existing shared API package and server integration remain untouched.
20. **State:** Existing project reducer, query cache, revision save session, and playback clock remain. Changes concern workspace preferences, initial AI visibility, selection switching to inspection, and initial timeline zoom.
21. **Performance:** Playback subscriptions and memoized timeline clips remain. Pointer resize previews update geometry without committing project state. No new polling, project data, library, or playback render loop was added. No quantitative performance claim is made.
22. **Changed files:** `apps/studio/features/studio/editor/components/{EditorShell,EditorToolbar,EditorTaskPanel,EditorLoading,EditorUnavailable}.tsx`; `hooks/{useEditor.tsx,useWorkspaceLayout.ts}`; `media/{MediaPanel,MediaItem}.tsx`; `preview/PreviewCanvas.tsx`; `timeline/Timeline.tsx`; `apps/studio/scripts/test-workspace.mjs`; this report.
23. **Lint:** Studio ESLint passed.
24. **Typecheck:** Studio `tsc --noEmit` passed. An initial failure came from a stale generated `.next/dev/types` route for a removed editor-review page; only that generated file was cleared.
25. **Production build:** Next.js production build passed with the documented `MAIN_APP_URL=https://app.blynta.com`. The first attempt used local development configuration, then the restricted environment could not download existing Google Fonts; network-enabled verification passed. No environment file or font configuration was changed.
26. **Limitations:** Browser checks mock API responses and a synthetic session; they verify editor behavior and structure, not live backend rendering or production SSO. Existing unsupported capabilities were not fabricated. Legacy CSS internals remain. Very narrow viewports use contextual overlays rather than showing all three panels simultaneously.

## Verification

- [x] Reference image used as structural source of truth; screenshots compared visually, including the reference-sized capture.
- [x] Far-left navigation spans the editor body.
- [x] Header starts in MainEditorArea.
- [x] Desktop upper workspace is Project Tools | Preview | Right Panel.
- [x] Timeline starts after permanent navigation and spans beneath the upper panels.
- [x] Track controls have their own aligned timeline column.
- [x] No second right vertical navigation rail.
- [x] Blynta theme retained; new styling uses Tailwind and semantic tokens.
- [x] Shared UI reused; no generic primitives duplicated.
- [x] Shared API infrastructure and existing Studio transport preserved.
- [x] SSO/auth architecture not modified.
- [x] Existing editor functionality exercised by regression and browser checks.

Browser coverage includes 2560, 1920, 1600, 1440, 1280, 1000, 768, 640, and 390 px widths; populated and empty projects; track alignment; panel collapse; pointer/keyboard resizing and persistence without autosave; playback and final frame; split/delete/history; AI proposal apply/undo; source fit/aspect ratio; input shortcut safety; naming/autosave; and export UI. Screenshots are saved under `.test-results/studio-editor-*.png`. The pure editor suite also passed history, immutability, synchronized trimming, transcript captions, grouped AI undo, serialized autosave/conflicts, and signed-URL stripping.
