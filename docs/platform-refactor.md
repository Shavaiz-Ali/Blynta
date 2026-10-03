# Platform refactor audit and deployment

## Before migration

The existing products are `frontend` (main), `blynta-studio` (Studio, port 3002), `admin`, and `landingpage`. Each has an npm lockfile and an independent Next.js application. The backend remains an independent NestJS npm project on port 5001, with MongoDB users, bcrypt passwords, Redis/ioredis, BullMQ, and bearer JWT guards. Main and Admin use Next 16.2.12; Studio uses 16.3.8.

Main's Base UI primitives and App wrappers are the design source. Product editor components must remain in Studio. Main has a dark split-panel authentication layout, react-hook-form/Zod validation, OTP signup, and Google/Facebook through Auth.js. Main and Admin expose a backend access token through their Auth.js session; Studio duplicates credentials and OAuth and optionally shares a domain cookie. There are no backend refresh sessions, authorization codes, or rate limits. JWTs default to seven days; the guard trusts the embedded role. CORS already uses ALLOWED_ORIGINS. Social endpoints accept browser-supplied identity fields without proof, a pre-existing impersonation vulnerability.

## Migration constraints

The course correction supersedes the original flat structure: all five existing/new frontends live in `apps/`, with shared packages in `packages/`. The Nest backend remains operationally independent. Preserve existing accounts, hashes, API contracts and backend AdminGuard. Extract source implementations, retaining compatibility exports until live provider flows pass. Studio was untracked at the start of this task; preserve its files. See `course-correction.md` for the reuse assessment and `migration-report.md` for the final architecture, validation and deployment instructions.

## Protocol basis

Use authorization codes, S256 PKCE, exact registered callback matching, browser-bound state, and server-side exchange according to https://www.rfc-editor.org/rfc/rfc9700.html and https://www.rfc-editor.org/rfc/rfc7636.html. Auth.js owns upstream Google/Facebook state and callback validation; it must run only in the central identity application after rollout. This is an internal first-party authorization service, not a general OIDC provider.
