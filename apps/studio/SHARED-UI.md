# Studio UI consistency

- Main app and Studio share AppSidebar, AppSidebarItem, and AppHeader from @blynta/ui. Editor rails use the same active, hover, spacing, and theme rules.
- The main app player lives in @blynta/ui/player. Studio binds its existing composition engine to the shared transport controls.
- Studio uses the shared theme without duplicate token definitions, loads the same fonts as the main app, and uses AppTabs for media sources and filters. Button content stays on one row; project choice cards keep their explicit vertical layout.
- Inspector and AI surfaces stretch to the preview row. Narrow screens retain contextual overlays and horizontal tool rails.
- Dashboard loading renders the actual dashboard structure with project skeletons. Editor routes and authentication use an editor skeleton with the workspace geometry and saved panel preferences.
- Imported assets return existing stored thumbnails first, then the owning clipping job's source thumbnail. Existing imports resolve their job through importKey; new imports and duplicates retain sourceJobId. Thumbnail URLs are added only to responses, never persisted in the timeline document. Image assets also return signed image thumbnails.

Redeploy the main app, Studio, and backend to apply these changes. No database migration is required.

Validation: production builds for all three apps; TypeScript and changed-file lint; 24 backend persistence/import tests; editor/history/autosave and upload lifecycle regressions. scripts/test-ui-consistency.mjs checks desktop/mobile layouts, inspector/AI heights, shared tabs, edits, thumbnail cards, project dialog, mobile sidebar, loading skeletons, and both themes with mocked API responses. It writes review screenshots to the repository's ignored .test-results folder.

## Theme and layout correction

The main app and Studio now consume AppViewModeToggle and AppMediaCard from packages/ui. Studio legacy CSS sits below shared UI utilities in the cascade; global focus and project-name input overrides were removed. Media sources use the main app default tabs. Editor fields use shared input/select sizes, and player controls explicitly use the themed surface appearance.

The editor timeline spans the workspace width, includes sufficient height for rendered tracks, and has an 8px resize handle. At widths below 1360px, side panels overlay the preview instead of shrinking it. Header project naming, save status, navigation rails, workspace account footer and skeleton geometry follow the revised layout. This correction changes only frontend and shared UI files. Redeploy the main app and Studio; it requires no backend deployment or migration.

scripts/test-theme-parity.mjs renders temporary identical component fixtures through both app root layouts and compares computed input, select, tab, card, button and textarea styles in light/dark themes and input focus. Fixtures are removed after the check. Run browser scripts sequentially because Next dev uses one lock per app. scripts/test-ui-consistency.mjs also checks timeline width/height, resize handle geometry and project menu visibility. API responses are mocked.
