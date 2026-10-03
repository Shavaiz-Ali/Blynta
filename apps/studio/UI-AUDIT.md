> Historical layout audit. The current cloud integration and verification report is [studio-workspace-integration.md](../../docs/studio-workspace-integration.md). Earlier mock-service and browser-storage descriptions below have been superseded.

# Studio redesign verification

## Editor and Projects workspace revision — 3 October 2026

- Contextual library: 280–360px, collapsible, resizable with pointer or keyboard;
  original footage uses a full-width thumbnail, generated clips use a two-column
  grid. Names have tooltips and hover/focus menus. Existing drag/drop remains.
- A single right task area switches between Inspector and nonmodal AI Sheet.
  AI is confined to the upper workspace; the timeline remains full-width.
  Narrow laptop AI layouts reserve preview space; smaller screens use overlays.
- Preview fits available width and height, preserves aspect ratio, and groups
  playback, centisecond timestamp, volume popover, zoom and fullscreen below it.
- Timeline height defaults to 38% of the available workspace and can be resized.
  Layout preferences persist locally. One scroll area keeps track headers/lanes
  aligned; the ruler stays visible while scrolling and headers stay at the left.
  Clips show source previews, duration, selected outlines and hover trim handles.
- Track locks block manual changes and reject conflicting AI proposals atomically.
  Inspector sections collapse. AI uses compact contextual suggestions, a growing
  composer, counted Apply actions, Discard and Undo, with preserved conversation.
- Projects use a 1560px content area, four/three/two-column responsive grids,
  compact list rows and subtle source metadata. Recent projects appear once.
  New project offers Upload, Import and Blank choices; URL import remains pending.
- Manually checked sample collections of 0, 1, 4 and 24 projects, grid/list,
  search/no results, 16:9/9:16, unselected/video/text/audio Inspector, open/collapsed
  media, AI empty/conversation, one/12 tracks, 1024×768, 1440×900 and 1920×1080,
  and both themes. Verified keyboard resizing, locks, scrubbing, split, undo/redo,
  Backspace deletion, Space playback, Ctrl+K, typing guards and Escape.
- Review fixtures use isolated sample data and are removed before delivery.
  Authentication UI and the central-auth integration boundary remain unchanged.

## Architecture

- Main frontend theme variables, typography, and AppButton/AppInput/AppSelect
  conventions reused. No separate theme token set added.
- App component layer wraps real shadcn/Base UI primitives, including dialogs,
  sheets, menus, context menus, sliders, scroll areas, tabs, popovers, commands,
  avatars, badges, skeletons, switches, and checkboxes.
- Features use App controls. ESLint rejects direct UI imports and native controls.
- Routes remain thin, following the main frontend's root folder structure.
- Auth/server state remains in Auth.js/TanStack Query; editor history, playhead,
  selection, tools, snapping, zoom, and panels remain in editor state.
- Mock data and actions remain behind repository/service boundaries.

## Browser checks

Checked with isolated sample-data components without modifying protected routes:

- Desktop dashboard, project metadata, focused New project dialog, aspect-ratio
  selector, validation, and Escape dismissal with focus restored to the trigger.
- Desktop editor proportions, fitted landscape/portrait preview, labeled sliders,
  useful project and selected-clip properties, and timeline context menus.
- AI Sheet keeps its conversation when closed/reopened. Apply trims all tracks;
  Undo restores the document; Discard prevents application. Preview remains
  interactive while the nonmodal Sheet is open.
- Dark/light themes, tablet preview with toggled property panel, mobile project
  library, and intentional editor guidance below 768px.
- Temporary component fixture routes removed before the production build.

## Remaining integration boundaries

Live sign-in, provider redirects, verification/reset email delivery, and shared
subdomain sessions require a running Blynta backend and configured providers.
Central auth is prepared but cannot be enabled until its service and verified
session contract exist. Video rendering, URL imports, transcription, style AI,
effects/transitions/brand kits, and remote media transfer remain explicit future
integrations. Current export downloads an edit-plan JSON, not rendered video.
## Final automated checks

Passed npm run lint, npm test, and npm run build (including TypeScript).
The production route list contains no temporary design-check route.

The built /dashboard route also loaded successfully with the existing Blynta
session and the protected account check. No new login, account creation, or
password change was performed.
