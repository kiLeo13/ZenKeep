# ARCHITECTURE.md

## Overview

ZenKeep is a monorepo with two deployable applications:

- `frontend/`: a React + TypeScript + Vite single-page application for note browsing, editing, and realtime collaboration.
- `backend/`: a Go API that exposes REST endpoints through Echo, persists data in SQLite through GORM, and integrates with AWS services for authentication, storage, and websocket delivery.

The repository-level contract is simple:

- frontend code lives under `frontend/`
- backend code lives under `backend/`
- repository automation lives under `.github/workflows/`
- repo-wide guidance lives only in `AGENTS.md` and this file

## Repository Layout

- `frontend/src/`
  Main SPA source tree.
- `backend/cmd/api/`
  Main API entrypoint.
- `backend/cmd/internal/`
  Backend application layers and internal packages.
- `backend/infrastructure/aws/lambda/`
  Websocket API Gateway shims.
- `.github/workflows/backend-ci-deploy.yml`
  Backend container build and publish workflow.

## Frontend Architecture

The frontend is a client-rendered SPA built with React 19 and Vite.
Routing is handled by `@tanstack/react-router`, state is managed with `zustand`, forms use `react-hook-form` plus `zod`, and the HTTP client is `axios`.

High-level flow:

1. `frontend/src/main.tsx` boots the app and mounts `RouterProvider`.
2. `frontend/src/router.tsx` creates the TanStack router from the generated route tree.
3. `frontend/src/routes/` defines the file-based route graph.
4. `frontend/src/pages/mainpage/MainPage.tsx` drives the authenticated app shell.
5. Zustand stores coordinate user/session state, note state, and presence state.
6. Service modules define API access and websocket event routing.
7. Board/renderer components choose how a note is displayed based on type and file extension.

Important frontend behavior:

- Auth state is stored locally and route protection is enforced in TanStack Router `beforeLoad` checks.
- Login and signup modals use auth-scoped wrappers around the shared modal input primitives from `frontend/src/components/modals/notes/shared/`. Signup password creation keeps its requirements in a focused Radix Popover component instead of parent-owned absolute-positioned markup. The password popover owns its shaded panel styling and uses layered Radix arrows so the border and arrow read as one connected surface.
- `frontend/package.json` pins transitive `uuid` resolution to `14.0.0` through npm `overrides` because `mermaid@10.9.5` still declares `uuid@^9.0.0`, which cannot satisfy the patched advisory range on its own.
- The currently opened note is driven by the typed `?id=` search parameter on the `/` route.
- Search-enabled custom selects move focus directly into their filter input when opened, and that autofocus is managed in the component after the menu opens instead of relying on undocumented Radix props.
- Notes can render as markdown, Mermaid flowcharts, or reference/file views.
- The update-note modal keeps its primary actions in a slim left-side rail so save and future note actions do not bloat the bottom edge of the form as the editor grows.
- The main page can reveal a lazy-loaded user management panel as the leftmost region. The users rail button is a persistent toggle, the notes sidebar keeps its fixed non-resizable rail beside the note list, and the content board shifts to the right while the panel is open.
- The notes sidebar groups notes by department, with General notes shown separately and department groups ordered alphabetically. Category headers are expandable with a short chevron rotation, search filters notes inside each group and hides only groups without matches, so the sidebar keeps its category shape while searching. Adjacent department groups keep a small visual gap while note rows inside each group remain dense.
- Users with `Edit Notes` can hold Ctrl and drag a sidebar note onto a category header to move the note to that department. The interaction uses the same note update API path as the edit modal and keeps frontend note state reconciled from the API response.
- Sidebar list structure is split under `frontend/src/components/sidebar/`: `Sidebar.tsx` owns data wiring, `Sidebar.helpers.ts` owns grouping/move helpers, `useSidebarInteractions.ts` owns keyboard and drag state, and the header, empty state, category group, and draggable note wrappers each keep their own CSS module.
- Department metadata and the grouped department membership map are owned by `frontend/src/stores/useDepartmentsStore.ts`; user records stay owned by `frontend/src/stores/useUsersStore.ts`.
- User management row actions can edit a target user's department memberships through the same shared multi-select menu used by permissions. Permission edits remain deferred behind an explicit save action, while department membership toggles call the department membership endpoints immediately and reconcile the departments store after each successful transaction.
- The department management modal is split into local department-specific components: `DepartmentSidebar`, `DepartmentActionsMenu`, `DepartmentDetailsForm`, `DepartmentMembersPanel`, `IconPicker`, and `DepartmentColorPicker`. Each component keeps its styles in a matching CSS module so modal orchestration stays separate from list, form, menu, member, icon picker, and color picker concerns. Main form field guidance is modeled through `ModalLabel` subtitles so labels and helper copy stay structurally consistent. The modal uses `note_count` to avoid rendering note bulk actions for empty departments and disables department deletion while notes still reference the department. The color picker presents reset and custom color as swatch-like boxes, with corner action icons and a centered checkmark only on the active choice.
- Sidebar note rows expose menu actions for all users to copy the note ID and download the note without opening a new tab. Markdown notes download as `.md`, reference notes download the stored attachment file, and Mermaid flowcharts export through the shared Mermaid SVG renderer as `.svg`. Destructive note actions sit after routine actions in the menu, separated by a divider and styled through the shared danger action variant.
- Heavy optional UI is loaded on demand instead of from the permanent shell:
  - The user management panel is imported only after the rail toggle is opened.
  - Sidebar utility modals are imported only when opened.
  - Board renderers are imported only when the active note needs them.
  - Markdown syntax highlighting styles now load from the markdown renderer path instead of the app root.
- Modal entrance and exit motion is centralized in `frontend/src/components/DarkWrapper.tsx` and `DarkWrapper.module.css`.
- The editor creation modal keeps `DarkWrapper` click isolation but lets mouse-down events reach native listeners so the Mermaid preview can use `react-zoom-pan-pinch` mouse dragging inside the dialog.
  Modal bodies should keep layout and visual styling only, while callers choose the shared `pop` or `slide-up` animation preset on the wrapper.
- Realtime updates come through the websocket manager and fan into stores.
- Department create, update, and delete events update the department store. Membership changes are treated as a scope change and trigger a full departments/users/notes resync for the affected client.
- The websocket client now identifies itself with a stable per-tab `session_id` stored in `sessionStorage`, and that identifier is generated with Web Crypto APIs instead of non-cryptographic randomness. Reconnects reuse that logical session so brief transport drops do not create duplicate backend sessions for the same tab.
- The frontend also stores the last applied replay cursor as `last_event_id` in `sessionStorage`. Reconnects send both `session_id` and `last_event_id` so the backend can resume from the missed event range instead of forcing a default full refresh.
- The `$connect` Lambda shim must forward `session_id` as `X-Session-Id` and `last_event_id` as `X-Last-Event-Id` to the Go API. The backend intentionally rejects connect requests that omit `session_id`, so frontend and connect-shim deployments need to stay in lockstep.
- Frontend websocket heartbeats are driven only while the document is visible. Normal reconnects now rely on buffered replay plus per-event targeted refreshes for open text notes; a full users/notes resync only happens after an explicit `RESYNC_REQUIRED` control event.
- Note websocket delivery is scope-aware: recipients only receive note events for notes they can currently access. Department changes are translated per recipient, so losing access becomes `NOTE_DELETED`, gaining access becomes `NOTE_CREATED`, and only users who can still see the note receive `NOTE_UPDATED`.
- Audit logs are surfaced through a permission-gated modal in that sidebar rail, auto-apply frontend filters on change, resolve actor and user-subject names through the users store plus on-demand user fetches, and page through the backend with cursor-style `next_before_id` pagination.
- Frontend audit event metadata is owned by `frontend/src/components/modals/global/audit/AuditLogEvent.ts`, while `frontend/src/components/modals/global/audit/auditPresentation.ts` formats UI copy from that registry. Each supported audit event declares whether the UI should allow row expansion through an `expands` flag.
- Expanded audit entries render their change rows with a local sequential code (`1..n`) per event, and the visible code accent still derives from the frontend event metadata.

### Frontend Type Modeling

- Zod schemas are exported as `camelCase` runtime values ending in `Schema`.
- TypeScript types and interfaces stay in `PascalCase`.
- Discriminated unions should use explicit per-variant schemas when the discriminator meaningfully changes the payload shape, especially for note and websocket event contracts.
- Shared frontend/backend seams should keep transport keys in snake_case on the wire and only transform to camelCase in schemas that intentionally expose a UI-facing model.
- Internal platform IDs are modeled as decimal strings in frontend schemas and stores, including `id`, `*_id`, websocket event IDs, route search IDs, and audit actor/subject IDs. Do not parse these IDs to `number`; Sonyflake values can exceed JavaScript's safe integer range.

### Frontend Routing And Code Splitting

- `frontend/src/routes/__root.tsx` owns the app-wide shell concerns such as the toaster and outlet.
- `frontend/src/routes/index.tsx` validates the home route search params and redirects unauthenticated access to `/login`.
- `frontend/src/routes/login.tsx` and `frontend/src/routes/register.tsx` keep auth screens outside the authenticated home route.
- `frontend/src/routes/api.reference.tsx` exposes the public `/api/reference` documentation route.
- `frontend/src/routeTree.gen.ts` is generated by TanStack Router and should be treated as build output, not handwritten source.
- `frontend/src/utils/createAsyncComponent.tsx` provides an `import()`-based async component helper so the app can lazy-load modal and renderer boundaries without relying on `React.lazy`.

### API Reference Documentation

The backend API docs surface is served by the frontend at `/api/reference`.
The page is intentionally public, but it documents backend wire behavior only:
authorization, errors, pagination, websocket envelopes, resources, and routes.
The root `/api/reference` page renders the Reference overview topics, including
the API Reference intro header, and keeps those sidebar links as in-page hash
navigation. Resource and gateway event details are routed pages under
`/api/reference/{id}`, such as `/api/reference/user`,
`/api/reference/server-events`, or `/api/reference/client-events`; unknown detail
IDs redirect back to `/api/reference`. The API reference sidebar keeps its brand
area fixed, renders categories expanded by default, and limits scrolling to the
navigation item list. Route-changing links should use TanStack Router link
integration so navigation stays client-side. The right-side "On this page" rail
is generated from the same API reference declarations, not from DOM scraping, and
tracks the active section within the main documentation scroll container.

The single source of truth for the rendered API reference is
`frontend/src/pages/api-reference/docs/apiReferenceDocs.ts`. That typed declaration
file owns topics, resource object declarations, route descriptions,
request/response fields, examples, and cross-links between routes and resources.
The TSX page should stay
a generic renderer over those declarations, so adding an endpoint or resource does
not require editing page layout code.
Each API reference renderer component lives in its own file and owns its CSS
through a matching local CSS module; keep layout, navigation, section, table,
callout, and code block styles with the component that renders the corresponding
markup. Reusable contract values such as note enums belong in resource
declaration sections so field tables can reference those declarations instead of
repeating enum lists.

When backend handlers, backend contracts, websocket events, or ID/cursor
semantics change, update `apiReferenceDocs.ts` in the same change.

## Backend Architecture

The backend is a Go service built around Echo, GORM, and SQLite.
It exposes REST endpoints, performs JWT-backed authentication, coordinates domain services, and uses AWS services for Cognito auth, S3-backed file storage, and websocket delivery infrastructure.

High-level startup flow:

1. `backend/cmd/api/main.go` loads environment configuration from `.env` or AWS-backed sources.
2. SQLite is initialized and `AutoMigrate` aligns the schema.
3. External integrations are created for Cognito, storage, websocket delivery, and company lookup.
4. Repositories, policies, services, handlers, and middleware are wired together.
5. Background jobs start for stale websocket connection cleanup and expired company cache cleanup.
6. Echo starts serving HTTP traffic on port `7070`.

Successful mutation routes that do not return a response body use `204 No Content`.
This includes empty DELETE acknowledgements, idempotent PUT membership changes,
logout/confirmation acknowledgements, websocket shim acknowledgements, and
department bulk mutation acknowledgements.

### Backend Layers

- `backend/cmd/internal/http/handler/`
  Route handlers and HTTP entrypoints.
- `backend/cmd/internal/http/middleware/`
  Request middleware such as auth resolution.
- `backend/cmd/internal/service/`
  Application services and jobs.
- `backend/cmd/internal/domain/sqlite/repository/`
  Persistence adapters over SQLite/GORM.
- `backend/cmd/internal/domain/entity/`
  GORM entities and schema/index tags.
- `backend/cmd/internal/contract/`
  Request and response contracts.

### Backend Naming

- Backend entity and contract types should prefer full domain words over abbreviations, such as `RegistrationStatus` and `Permissions`.
- Renaming Go struct fields for clarity must not change the published JSON contract unless the API behavior is intentionally changing.

### Persistence Model

SQLite initialization lives in `backend/cmd/internal/domain/sqlite/db.go`.

Persisted entities include:

- `audit_log_events`
- `audit_log_changes`
- `departments`
- `department_memberships`
- `users`
- `notes`
- `connections`
- `socket_deliveries`
- `companies`
- `company_partners`

Internal platform IDs are generated by `backend/cmd/internal/idgen`.
The shared generator uses Sonyflake with a `2025-01-01T00:00:00Z` epoch and returns numeric `int64` values for SQLite persistence.
API contracts and websocket payloads serialize internal IDs as decimal strings, including `id`, `*_id`, audit event IDs, audit actor IDs, user/note subject IDs, and pagination cursors such as `next_before_id`.
Audit log change row IDs remain local numeric row IDs, and company CNPJs remain string business identifiers rather than generated platform IDs.

The audit system stores one parent event with zero or more child change rows.

Departments model the primary note scope. A note has a nullable `department_id`:
`NULL` means General content, while a non-null value points to exactly one
department. Users can belong to many departments through `department_memberships`.
The note entity stores only the nullable department ID rather than a hydrated
department association. Department deletion is blocked in the service layer while
notes still reference it, so callers must bulk-move or bulk-delete those notes
before deleting the department. Department icons support `NONE`, `EMOJI`, and
`IMAGE`; `NONE` is the text-only mode and stores an empty icon value. The
frontend recommends department icon images up to 256 KiB for responsive sidebar
rendering, while the backend rejects uploaded department icons over 512 KiB as a
hard safety limit. Departments can also store a nullable `color_rgba` value as a
32-bit integer in 0xRRGGBBAA order. The frontend applies that value only to the
sidebar department name text through the CSS `color` property. Department API and
websocket department objects include `note_count`, which is the current number of
notes assigned to that department.

The `connections` table now models logical websocket sessions, not only raw API Gateway transport IDs. Each row stores:

- the current API Gateway `connection_id`
- a stable frontend-provided `session_id`
- heartbeat timestamps for active transports
- disconnect/grace timestamps for temporarily resumable sessions

This allows the backend to keep a session logically online for a short reconnect window while still preventing duplicate active transports for the same browser tab.

The `socket_deliveries` table stores the replayable websocket stream per user. Each row contains:

- an auto-incrementing `event_id` used as the resume cursor
- the target `user_id`
- the exact event type and payload that were delivered to that user
- a `scope_changed` flag used to force a safe fallback resync when replay would be risky
- the delivery timestamp for retention cleanup

Replayable websocket events are:

- `NOTE_CREATED`
- `NOTE_UPDATED`
- `NOTE_DELETED`
- `DEPARTMENT_CREATED`
- `DEPARTMENT_UPDATED`
- `DEPARTMENT_DELETED`
- `USER_CREATED`
- `USER_UPDATED`
- `USER_DELETED`
- `PRESENCE_UPDATED`
- `RESYNC_REQUIRED`

System-only websocket messages such as `ACK`, `SESSION_EXPIRED`, and `CONNECTION_KILL` are delivered live but are not written to the replay log.

Current audit coverage includes:

- note create, update, and delete
- department create, update, delete, membership add/remove, note bulk-move, and note bulk-delete
- user update, suspend/unsuspend, and delete
- company lookup by CNPJ, including not-found lookups with outcome metadata

Department membership add/remove audit events intentionally carry no child
change rows. The membership mutation itself is the meaningful event; adding a
synthetic `user_id` field change only exposes an internal ID without useful
review context.

Company lookup misses are negatively cached in the `companies` table with `found=false`.
The application sets `found=true` for successful Minha Receita responses and `found=false` for not-found responses explicitly; the column must not rely on a database default, because repeated not-found lookups must keep returning `404` from the cached miss instead of an empty company response.

Audit log reads are exposed through `GET /audit-logs`.
That endpoint is protected by the dedicated `PermissionReadAuditLogs` bit and returns the newest entries first with `limit` and `before_id` pagination.

## Frontend/Backend Integration

The SPA talks to the Go API over HTTP and uses websocket connectivity for realtime updates.
That creates a few important cross-project seams:

- authentication tokens issued by the backend auth stack are stored and consumed by the frontend session store
- note contracts must stay aligned between frontend `types/` and backend `contract/` plus service behavior
- department contracts must stay aligned between frontend `types/` and backend `contract/`; this includes department objects, `icon_type`, nullable `color_rgba`, `note_count`, the `/departments/users` department-to-user-ID map, note `department_id`, and department websocket event payloads
- audit log contracts and permission bit offsets must stay aligned between frontend `types/models` and backend `contract/entity` layers
- websocket event shapes must stay aligned between backend event emitters and frontend event schemas
- file and reference note handling depends on both backend storage behavior and frontend renderer support
- websocket reconnect semantics span both sides: the frontend must reconnect with the same `session_id`, and the backend must replace old transports for that session instead of stacking rows
- the websocket replay cursor is also cross-project state: the frontend persists `last_event_id`, the backend emits ordered `event_id` values, and both sides must treat them as decimal strings on the wire
- the websocket `$connect` shim is part of that contract, because it is responsible for forwarding both `session_id` and `last_event_id` from the browser query string into the backend request headers

When a change crosses one of those seams, validate both sides instead of trusting the universe to be kind for once.

## Deployment And Automation

### Frontend

The frontend is intended to be built from `frontend/` and deployed independently from the backend.
Its build inputs and package metadata now live entirely within that directory.
The Vite build now runs TanStack Router route generation before TypeScript compilation so the generated route tree stays aligned with `frontend/src/routes/`.
Production assets are emitted with hash-only filenames so downloaded chunks do not expose component or feature names.

### Backend

The backend is built into a Docker image from `backend/Dockerfile`.
Repository automation for backend publishing lives at `.github/workflows/backend-ci-deploy.yml`.

That workflow is intentionally scoped to:

- changes under `backend/**`
- changes to `.github/workflows/backend-ci-deploy.yml`

This keeps backend publish automation asleep when only frontend files change.

## Local Development Boundaries

- Frontend commands should be run from `frontend/`.
- Backend commands should be run from `backend/`.
- Treat `frontend/.env` and `backend/.env` as sensitive local configuration.
- The backend Go module boundary is `backend/go.mod`.
- The frontend Node/Vite boundary is `frontend/package.json`.

## Documentation Rules

- Repo-level architectural guidance belongs only in `AGENTS.md` and `ARCHITECTURE.md`.
- Do not reintroduce duplicate repo-level `AGENTS.md` or `ARCHITECTURE.md` files inside subdirectories.
- API contract documentation for the rendered reference belongs in `frontend/src/pages/api-reference/docs/apiReferenceDocs.ts` and is surfaced by the frontend `/api/reference` route.
- If the monorepo layout or the frontend/backend interaction model changes, update this file in the same change.
