# AGENTS.md

## Purpose

This repository is the ZenKeep monorepo.
It contains the React frontend in `frontend/` and the Go backend in `backend/`.
Use this file as the single repo-level guide before reading code in depth.

Primary goals for future agents:

- Avoid broad repo scans when a narrower read path will do.
- Start from the smallest relevant slice of the monorepo.
- Prefer store/service/type entry points in the frontend and handler/service/repository entry points in the backend.
- Keep monorepo changes scoped so frontend and backend work do not accidentally bleed into each other.

## Monorepo Layout

- `frontend/`
  React 19 + TypeScript + Vite SPA.
- `backend/`
  Go API with Echo, GORM, SQLite, AWS integrations, and websocket shims.
- `.github/workflows/`
  Repository-level automation. Backend deploy workflow lives here.
- `AGENTS.md`
  The only agent guidance file in the repo.
- `ARCHITECTURE.md`
  The only architecture overview file in the repo.

## What To Read First

For frontend work, read these in order:

1. `frontend/package.json`
2. `frontend/src/main.tsx`
3. `frontend/src/router.tsx`
4. Relevant route in `frontend/src/routes/`
5. `frontend/src/pages/mainpage/MainPage.tsx`
6. Relevant store in `frontend/src/stores/`
7. Relevant service in `frontend/src/services/`
8. Matching schema/type file in `frontend/src/types/`

For backend work, read these in order:

1. `backend/go.mod`
2. `backend/cmd/api/main.go`
3. Relevant handler in `backend/cmd/internal/http/handler/`
4. Relevant service in `backend/cmd/internal/service/`
5. Relevant repository in `backend/cmd/internal/domain/sqlite/repository/`
6. Matching entity or contract file in `backend/cmd/internal/domain/entity/` or `backend/cmd/internal/contract/`

That sequence usually gives enough context without spelunking the whole repo like a cursed cave system.

## Fast Project Summary

### Frontend

- Framework: `React 19` with `@tanstack/react-router`
- State: `zustand`
- Forms/validation: `react-hook-form` + `zod`
- API client: `axios`
- Realtime: `react-use-websocket`
- Rendering modes:
  - Markdown notes
  - Mermaid flowcharts
  - File/reference notes (`pdf`, image, video, audio)
- i18n: `i18next`, currently `pt-BR` only
- Styling: CSS modules plus global `frontend/src/index.css`

### Backend

- Runtime: `Go`
- HTTP framework: `Echo`
- Persistence: `SQLite` via `GORM`
- Auth/storage/integration: AWS Cognito, S3, API Gateway websocket support, SSM
- Background jobs:
  - stale websocket connection cleanup
  - expired company cache cleanup
- Deployment artifact: Docker image built from `backend/Dockerfile`

## High-Signal Index

### Frontend App Shell And Routing

- `frontend/src/main.tsx`: React bootstrap, `RouterProvider`, and global CSS.
- `frontend/src/router.tsx`: TanStack Router creation and router-wide defaults.
- `frontend/src/routes/__root.tsx`: root route shell with toaster and outlet.
- `frontend/src/routes/index.tsx`: authenticated home route with typed search params and auth redirect.
- `frontend/src/routes/login.tsx`: login screen route.
- `frontend/src/routes/register.tsx`: signup screen route.
- `frontend/src/components/modals/auth/`: login, signup, verification, and auth-scoped form helpers. Keep auth text fields on top of the shared modal input primitives, and keep signup password requirements inside the local `PasswordCreationInput` Radix Popover.
- `frontend/src/routes/api.reference.tsx`: public API reference route at `/api/reference`.
- `frontend/src/routeTree.gen.ts`: generated TanStack route tree. Do not hand-edit it unless you enjoy arguing with the generator.

### Frontend Main Screen Flow

- `frontend/src/pages/mainpage/MainPage.tsx`: main authenticated screen.
  - Reads typed `?id=` search params from the TanStack index route.
  - Opens/closes notes.
  - Initializes websocket manager.
  - Loads current user.
  - Renders the resizable notes sidebar + content board layout.
- `frontend/src/components/DarkWrapper.tsx`: shared Radix dialog wrapper for modal overlay, focus trap, and modal open/close animation presets.
- `frontend/src/components/sidebar/Sidebar.tsx`: note search, note list, and sidebar data wiring. Local sidebar child components own their matching CSS modules; shared grouping/move helpers live in `Sidebar.helpers.ts`, and keyboard/drag state lives in `useSidebarInteractions.ts`.
- `frontend/src/components/sidebar/SidebarRail.tsx`: fixed left utility rail for note creation, utility modals, user management, and settings. Heavy modal bodies are loaded on demand.
- `frontend/src/components/board/ContentBoard.tsx`: dispatches note rendering by note type/file extension. Renderer frames are loaded on demand.
- `frontend/src/utils/createAsyncComponent.tsx`: shared `import()`-based async component helper for modal and renderer boundaries without `React.lazy`.

### Frontend Stores

- `frontend/src/stores/useSessionStore.ts`
  - Stores current user.
  - Persists/retrieves JWTs from `localStorage`.
  - Handles login/logout helpers.
- `frontend/src/stores/useNotesStore.ts`
  - Central source for note list and currently opened note.
  - Handles list caching, note fetch, note open/close, render loading state.
  - Start here for note bugs.
- `frontend/src/stores/useDepartmentsStore.ts`
  - Department metadata cache and grouped department membership map.
  - Owns department state while `useUsersStore` remains the source of truth for user records.
- `frontend/src/stores/useUsersStore.ts`
  - User list cache and presence updates.

### Frontend Services

- `frontend/src/services/apiClient.ts`
  - Axios instance.
  - Injects `id_token` into `Authorization`.
  - Redirects to `/login` on `401`.
- `frontend/src/services/safeApiCall.ts`
  - Shared API wrapper with Zod parsing and normalized error handling.
- `frontend/src/services/noteService.ts`
  - CRUD for notes.
  - Upload vs editor note creation logic.
  - File extension/size constants.
- `frontend/src/services/departmentService.ts`
  - Department CRUD, membership edge mutations, and department note bulk actions.
- `frontend/src/services/auditService.ts`
  - Audit log listing client.
  - Uses `limit` + `before_id` cursor pagination against `/audit-logs`.
  - Supports actor/action/subject filters used by the audit modal.
- `frontend/src/services/userService.ts`
  - Auth and user management requests.
- `frontend/src/services/i18n.ts`
  - i18n bootstrap.
- `frontend/src/services/socketSession.ts`
  - Stable per-tab websocket session ID and replay cursor storage.
- `frontend/src/services/socketBus.ts`
  - Internal pub/sub for websocket events.

### Type And Schema Conventions

- Frontend TypeScript types, interfaces, and inferred aliases use `PascalCase`.
- Frontend Zod runtime values use `camelCase`, with schema exports ending in `Schema`.
- Prefer explicit discriminated-union variants over umbrella branches when a payload shape changes by discriminator value.
- Keep frontend parsed contracts aligned with backend JSON keys on the wire, but only transform keys when the consuming UI model really needs a camelCase shape.
- Backend exported domain and contract names should avoid shorthands like `Reg` or `Perms` in favor of full words such as `Registration` and `Permissions`.
- Backend JSON field names remain snake_case on the wire even when Go struct fields are renamed for clarity.

### Frontend Websocket / Realtime

- `frontend/src/hooks/useWebSocketManager.ts`
  - Main websocket connection lifecycle.
  - Routes socket events into stores and toast/logout behavior.
- `frontend/src/models/events/GatewayEvent.ts`
  - Server event registry and discriminated union schema.
- `frontend/src/types/websocket/events.ts`
  - Kill codes and presence payload schemas.

### API Reference Docs

- `frontend/src/pages/api-reference/docs/apiReferenceDocs.ts`
  - Single source of truth for rendered backend API reference content: topics, resources, object fields, routes, request/response fields, examples, and route-to-resource links.
- `frontend/src/pages/api-reference/`
  - Dark in-app documentation renderer at `/api/reference`. Page entrypoint stays at the folder root, while renderer components, docs declarations, hooks, and route guards live in nested folders. Keep TSX generic; adding resources or endpoints should only require changing declarations.

Update these docs whenever backend handlers/contracts, frontend API schemas, or
websocket event shapes change. The docs should describe the wire contract, not
client-side transformed models.

### Backend Entrypoints

- `backend/cmd/api/main.go`: main API process bootstrap.
- `backend/infrastructure/aws/lambda/ws-connect-shim/index.mjs`: websocket connect shim.
- `backend/infrastructure/aws/lambda/ws-message-shim/index.mjs`: websocket message shim.

### Backend HTTP Flow

- `backend/cmd/internal/http/handler/`: Echo route handlers.
- `backend/cmd/internal/http/middleware/auth_middleware.go`: resolves authenticated user by `sub_uuid`.
- `backend/cmd/internal/service/`: application services and background jobs.
- `backend/cmd/internal/domain/sqlite/repository/`: SQLite-backed repositories.

### Backend Persistence And Domain

- `backend/cmd/internal/domain/sqlite/db.go`: SQLite bootstrap and automigration.
- `backend/cmd/internal/domain/entity/`: GORM entities and schema tags.
- `backend/cmd/internal/contract/`: API contracts.
- `backend/cmd/internal/domain/events/events.go`: event payloads.
- `backend/cmd/internal/idgen/`: shared Sonyflake ID generation and decimal string formatting/parsing helpers.

## Practical Read Paths By Task

### If The Task Is About Frontend Auth

Read:

1. `frontend/src/pages/auth/`
2. `frontend/src/components/modals/auth/`
3. `frontend/src/stores/useSessionStore.ts`
4. `frontend/src/services/userService.ts`
5. `frontend/src/utils/authutils.ts`
6. `frontend/src/types/api/users.ts`

### If The Task Is About Frontend Notes CRUD

Read:

1. `frontend/src/stores/useNotesStore.ts`
2. `frontend/src/stores/useDepartmentsStore.ts` if department scope is involved
3. `frontend/src/services/noteService.ts`
4. `frontend/src/types/api/notes.ts`
5. `frontend/src/types/forms/notes.ts`
6. Relevant modal or board component

### If The Task Is About Frontend Departments

Read:

1. `frontend/src/stores/useDepartmentsStore.ts`
2. `frontend/src/services/departmentService.ts`
3. `frontend/src/types/api/departments.ts`
4. `frontend/src/components/sidebar/Sidebar.tsx`
5. `frontend/src/components/modals/departments/DepartmentManagementModal.tsx`

### If The Task Is About Frontend Realtime Updates

Read:

1. `frontend/src/hooks/useWebSocketManager.ts`
2. `frontend/src/models/events/GatewayEvent.ts`
3. `frontend/src/types/websocket/events.ts`
4. Affected zustand store

### If The Task Is About Frontend Audit Logs

Read:

1. `frontend/src/components/sidebar/SidebarRail.tsx`
2. `frontend/src/components/modals/global/audit/AuditLogsModal.tsx`
3. `frontend/src/services/auditService.ts`
4. `frontend/src/types/api/audit.ts`
5. `frontend/src/models/Permission.ts`

### If The Task Is About Backend Auth Or User Resolution

Read:

1. `backend/cmd/internal/http/middleware/auth_middleware.go`
2. `backend/cmd/internal/service/user_service.go`
3. `backend/cmd/internal/domain/sqlite/repository/user_repository.go`
4. `backend/cmd/internal/domain/entity/user.go`
5. `backend/cmd/internal/contract/user_contract.go`

### If The Task Is About Backend Notes

Read:

1. `backend/cmd/internal/http/handler/note_routes.go`
2. `backend/cmd/internal/service/note_service.go`
3. `backend/cmd/internal/domain/sqlite/repository/note_repository.go`
4. `backend/cmd/internal/domain/entity/note.go`
5. `backend/cmd/internal/contract/note_contract.go`

### If The Task Is About Backend Departments

Read:

1. `backend/cmd/internal/http/handler/department_routes.go`
2. `backend/cmd/internal/service/department_service.go`
3. `backend/cmd/internal/domain/sqlite/repository/department_repository.go`
4. `backend/cmd/internal/domain/entity/department.go`
5. `backend/cmd/internal/contract/department_contract.go`

### If The Task Is About Backend Audit Logs

Read:

1. `backend/cmd/internal/http/handler/audit_routes.go`
2. `backend/cmd/internal/service/audit_service.go`
3. `backend/cmd/internal/service/audit_helpers.go`
4. `backend/cmd/internal/domain/sqlite/repository/audit_repository.go`
5. `backend/cmd/internal/service/audit_integration_test.go`

### If The Task Is About Backend Realtime

Read:

1. `backend/cmd/internal/http/handler/websocket_routes.go`
2. `backend/cmd/internal/service/websocket_service.go`
3. `backend/cmd/internal/domain/sqlite/repository/connection_repository.go`
4. `backend/cmd/internal/domain/entity/connection.go`
5. `backend/infrastructure/aws/lambda/ws-connect-shim/index.mjs`

## Environment And Config

### Frontend

- `frontend/.env`
  - `VITE_API_BASE_URL`
  - `VITE_WS_URL`
- `frontend/vite.config.ts`
  - `@` alias to `src`
  - TanStack Router Vite plugin with route generation and auto code splitting
  - React compiler Babel plugin enabled
- `frontend/tsconfig.app.json`
  - strict mode enabled
  - alias path mapping for `@/*`
- `frontend/eslint.config.js`
  - lint rules
  - ignores generated `frontend/src/routeTree.gen.ts`
- `frontend/package.json`
  - uses npm `overrides` to force `uuid@14.0.0` while `mermaid@10.9.5` still declares the vulnerable `uuid@^9.0.0` range.

### Backend

- `backend/.env`
  Local development values. Treat as sensitive.
- `backend/docker-compose.yml`
  Local container wiring.
- `backend/Dockerfile`
  Production image build definition.
- `backend/go.mod`
  Go module boundary for backend code.

Do not copy environment values into docs or comments unless explicitly needed.

## Important Behavior Notes

- The frontend currently sends `id_token` in API requests even though auth data also includes `access_token`.
- Auth login and signup fields should use the auth wrappers over `BaseModalTextInput`, `ModalLabel`, and `ModalSection` so authentication forms stay visually aligned with the rest of the modal system.
- Route protection is handled in TanStack Router route guards instead of a dedicated `ProtectedRoute` wrapper.
- `frontend/src/pages/mainpage/MainPage.tsx` drives note opening via typed `?id=` search params on the `/` route.
- Notes are scoped by nullable `department_id`: `null` means General, and a non-null value points to exactly one department. Users may belong to multiple departments through membership edges.
- Department icons support `NONE`, `EMOJI`, and `IMAGE`. `NONE` means text-only; the frontend recommends image icons up to 256 KiB, and the backend rejects uploaded department icons over 512 KiB. Department `color_rgba` is a nullable integer in 0xRRGGBBAA order and should only color the sidebar department name text via CSS `color`.
- Department membership state is ID-only and separate from user objects. The `/departments/users` contract returns `departments` as a map of department ID to user ID arrays. Keep `useUsersStore` as the source of truth for user data and `useDepartmentsStore` as the source of truth for department metadata plus that grouped membership map.
- User management row actions expose department membership toggles through `UserDepartmentsSubMenu`. Keep it on the shared `MultiSelectMenu` immediate-toggle path, while permission edits stay on the explicit-save path to avoid stale permission mask writes.
- The sidebar preserves department grouping while searching: it filters notes inside each department and hides only empty groups. Category headers are expandable with a short chevron rotation, and users with `Edit Notes` can hold Ctrl and drag a note onto a category header to move it through the standard note update endpoint.
- Department deletion is intentionally guarded. Departments with notes must have those notes bulk-moved or bulk-deleted before the department can be removed.
- Audit logs are opened from `SidebarRail`, auto-apply frontend filters on change, and page through `/audit-logs` in chunks of `50` using `next_before_id`.
- The audit modal resolves actor names from `useUsersStore` first and falls back to `userService.getUserById` for users that are no longer present in the active list.
- Company lookup audit events are recorded for both hits and misses, with `found` and `cache_hit` change rows describing the outcome.
- Company lookup misses are cached as `companies` rows with `found=false`; do not put a database default back on `Company.Found`, because GORM can omit false zero values and turn repeated misses into empty successful company responses.
- Internal platform IDs are stored as numeric `int64` values in SQLite but serialized as decimal strings in API and websocket contracts. The frontend must keep these values as strings and never parse them to JavaScript numbers.
- New platform IDs are generated through `backend/cmd/internal/idgen` using Sonyflake with a `2025-01-01T00:00:00Z` epoch. Audit log change IDs are local numeric rows, and CNPJs stay business identifiers rather than generated IDs.
- `frontend/src/stores/useNotesStore.ts` treats `REFERENCE` notes differently from text notes.
- Sidebar utility modals and board renderer frames are lazy-loaded with plain `import()` helpers so the app shell does not eagerly pull the whole circus into the entry bundle.
- Shared modal opening and closing animations belong in `frontend/src/components/DarkWrapper.module.css`; modal CSS modules should not duplicate `smoothToggleModal` keyframes.
- The editor creation modal opts out of `DarkWrapper` mouse-down isolation while keeping click isolation, because Mermaid preview panning starts from a native window `mousedown` listener in `react-zoom-pan-pinch`.
- Backend startup loads config, initializes SQLite, wires AWS-backed dependencies, starts background jobs, and serves Echo on port `7070`.
- Backend audit log reads are protected by `PermissionReadAuditLogs`; admins still inherit access through effective permission checks.
- Backend websocket events can mutate frontend-visible state through the websocket pipeline, so frontend and backend changes around realtime need to be checked together.
- Department membership changes alter note scope. The backend sends scope-change resync signals so the frontend refreshes users, notes, and departments instead of trying to infer every affected row locally.
- Websocket presence is now tied to a logical per-tab `session_id` with a reconnect grace window, not just the raw API Gateway `connection_id`. Temporary disconnects should resume the same session instead of creating duplicate active connections.
- The frontend also persists the last applied websocket replay cursor as `last_event_id` in `sessionStorage`. Reconnects must reuse the same `session_id` and send that cursor so the backend can replay missed events in order.
- The frontend only sends websocket pings while the tab is visible. Hidden-tab reconnect behavior is expected to rely on session resumption plus ordered replay, with a full notes/users resync only after an explicit `RESYNC_REQUIRED` control event.
- The websocket connect path is intentionally strict: the frontend must provide `session_id`, the `$connect` shim must forward it as `X-Session-Id`, and the backend should reject connects that omit it rather than silently downgrading to transport-only sessions. When present, the shim must also forward `last_event_id` as `X-Last-Event-Id`.

## Workflow Notes

- Backend container publishing workflow lives at `.github/workflows/backend-ci-deploy.yml`.
- The backend workflow should only trigger when backend files or that workflow file change.
- There is no separate backend-local workflow file anymore. Keep repo automation at the root.

## Token-Saving Guidance

Usually safe to skip on first pass:

- `frontend/node_modules/`
- Most `frontend/*.module.css` descendants unless styling is the task
- `frontend/public/` unless asset work is requested
- `frontend/src/locales/pt-br.json` unless changing copy or translation keys
- Backend implementation areas unrelated to the feature at hand

Prefer reading:

- Frontend store before UI
- Frontend service before debugging network behavior
- Backend handler before route behavior
- Backend service before repository tweaks
- Backend repository before schema/index changes
- Zod schema or Go contract before changing payload handling

## Known Repo Quirks

- The root README has encoding artifacts, so trust source files more than README wording when they disagree.
- The frontend move already happened, so older assumptions that the SPA lives at repo root are stale.
- The backend import preserved history under `backend/`, which is what we want. No need to reinvent that wheel with file-copy chaos.
- Some features are internal/admin-oriented and hidden behind permission bitmasks or backend policy checks.

## Suggested Workflow For Future Agents

1. Read this file.
2. Identify whether the task is in `frontend/`, `backend/`, or both.
3. Open the relevant store/service/type or handler/service/repository chain first.
4. Keep diffs scoped to the affected package unless the change is intentionally cross-cutting.
5. Update the root docs when the monorepo layout or cross-project behavior changes.
