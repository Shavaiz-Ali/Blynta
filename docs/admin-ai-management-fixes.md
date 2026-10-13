# Admin AI management fixes

13 October 2026.

The provider, model and credential save actions used AppButton without an explicit submit type. That component defaults to button, so clicking Save did not submit the form. All three now use type="submit". A synchronous action lock prevents repeated writes while a request is pending; errors preserve provider/model fields for correction and retry. Credential secrets retain the existing reset-after-submission behavior.

Provider adapters use the new shared AppRadioGroup, and task/capability/plan/status fields use shared AppCheckbox. Both wrap the already installed Base UI package; no dependency installation was necessary. Pending OpenAI/Anthropic adapters are clearly labelled and must be saved disabled, matching existing backend validation. Editing cannot change the provider adapter. Code validation includes a useful lowercase-code hint.

The model dialog is now up to 896px wide with responsive two-column sections, a slim scrolling body and persistent title/save/cancel controls. Provider and credential dialogs use wider existing shared dialog primitives. Keys that changed on dialog closure were moved from popup elements to forms where needed, avoiding a closing popup that blocked background clicks.

Providers, Models and Usage use the existing admin AppDataTable (imported as AppTable). Loading and empty records belong to that table; duplicate external empty panels and unnecessary first-page pagination are removed. Search and status filtering remain server-backed. AppPageHeader aligns the title, description and add action with the admin design system. AI nested routes now resolve their parent breadcrumb and section rather than falling back to Details.

Model submission also validates at least one task and either both bounded token prices or neither, preserving the backend contract. No backend source, API, registry security, credential encryption, environment variable, database migration or dependency changed.

## Verification

- 91 relevant frontend regression tests passed, including actual admin rendering and nested breadcrumb tests.
- 7 existing backend admin registry validation/security tests passed.
- Admin and shared UI type checks passed. Scoped admin/shared-control lint passed without warnings.
- Chrome at 390, 1024 and 1440px exercised provider/model/credential submissions and serialized radio/checkbox values, request-failure retry, disabled pending-adapter creation, invalid pricing/missing-task rejection, dialog closure and shared-table empty state. Ten screenshots and six interaction entries are retained in admin-ai-management-evidence/results.json.
- Production admin and main-app builds passed; temporary fixture routes are absent from both route lists.

Browser requests used isolated synthetic API/auth responses because the local backend on port 5001 was unavailable. No live provider/credential configuration was created and no paid connection test was invoked. The preview uses an authenticated development fixture route, so its top breadcrumb shows Details; the real /ai/providers, /ai/models and /ai/usage breadcrumbs are verified separately by regression tests. Temporary fixture routes are removed before builds.

[Wide model dialog](admin-ai-management-evidence/model-dialog-1440.png) · [Provider dialog](admin-ai-management-evidence/provider-dialog-1440.png) · [Shared empty usage table](admin-ai-management-evidence/usage-empty-1440.png)

The user requested committing and pushing this admin fix together with the Studio icon/tab/scrollbar polish. Both changes affect frontend code only; no backend, environment or database migration changes are required.
