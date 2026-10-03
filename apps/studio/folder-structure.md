# Blynta Studio folder structure

This application follows the existing `apps/app/` layout: folders live at the
application root, without introducing a separate `src/` tree.

```text
app/                           App Router: thin routes, layouts, boundaries
  (auth)/                      login, signup, forgot-password, reset-password
  (main)/                      protected dashboard and editor/[projectId]
  api/                         Auth.js and existing-auth API forwarding only
components/
  ui/                          Blynta's shadcn/Base UI primitives
  common/                      App* controls, branding, theme, account, loading
features/
  auth/                        API contracts, queries, forms, session handling
    components/
    central-auth.ts            optional central redirects and safe return URLs
    api.ts
    queries.ts
    types.ts
    index.ts
  studio/
    dashboard/components/      dashboard and project cards
    projects/                  cloud document helpers and media upload
      components/              project creation
      hooks/
    editor/
      components/              editor shell, toolbar, export settings
      media/
      preview/
      inspector/               element-specific property editors
      timeline/                tracks, clips, trim and playhead interaction
      ai/                      persistent Sheet, proposals, mock action service
      hooks/                   editor context, playback and keyboard behavior
      stores/                  editor document reducer and undo/redo history
      utils/
    types.ts
    index.ts
providers/                     session, TanStack Query, theme, toasts
config/                        environment and envelope-aware HTTP boundary
lib/validators/                shared Blynta Zod validation
types/                         Auth.js module augmentation
public/                        static assets
scripts/                       pure editor-state verification
auth.ts                        Blynta-backed Auth.js configuration
proxy.ts                       protected-route redirect and return destination
```

Server/auth state uses TanStack Query and Auth.js. Editor state uses a dedicated
React reducer, separate from query state. The Studio repository uses account-scoped
browser storage; replacing it with a future service does not require rewriting
page components. No Studio processing API is invented here.

The App layer wraps actual shadcn/Base UI controls; feature code never imports
`components/ui` directly. ESLint enforces that boundary and rejects native feature
form controls. `AppFileInput` encapsulates file-chooser access through a shadcn
Input, while visible browse buttons use AppButton. Timeline clips and trim handles
are purpose-built editing geometry, with an AppContextMenu for standard actions.

The dashboard's presentational `DashboardWorkspace` is separate from account-scoped
project loading. EditorWorkspace accepts a project and identity scope, while the
route component handles loading and authentication. AI's mock service generates
structured proposals; the document reducer applies them through the same undo
history as manual editing. Media source group and original/generated identifiers
are optional typed metadata for future Blynta media integration.
Workspace dimensions and panel visibility live in editor/hooks/useWorkspaceLayout.ts.
The common AppResizeHandle provides bounded pointer and keyboard resizing; AppDisclosure
provides accessible Inspector sections through AppButton. Layout storage is separate
from document undo history and account-scoped project storage.
