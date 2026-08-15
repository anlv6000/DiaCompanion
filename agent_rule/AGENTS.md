# AGENTS.md — DiaCompanion Web (current-code aligned)

Build conventions for AI coding agents. Read `DESIGN.md` before generating or changing UI.

## Scope

The Web console serves **Admin, Doctor, and Receptionist** roles.

Patients use the separate **React Native + Expo** application in
`Frontend-App_Native`; do not add patient-mobile screens to this Web project.

An Electron scaffold exists under `electron/`, but browser behavior remains the primary
implementation and verification target.

## Current stack (source of truth)

- Vite + React 18 + TypeScript
- React Router DOM (`BrowserRouter`)
- Custom CSS in `src/styles/app.css`
- Custom UI primitives in `src/components/ui.tsx`
- Custom lightweight SVG charts in `src/components/charts.tsx`
- Context providers:
  - `AuthContext`
  - `DataContext`
  - `ToastContext`
- API layer:
  - `src/api/client.ts`
  - `src/api/services.ts`
- Custom async/debounce hooks in `src/lib/hooks.ts`
- Runtime Web API config intended through `public/config.js`

Do **not** require Tailwind, shadcn/ui, TanStack Query, Recharts, OpenSeadragon, or
lucide-react as a prerequisite. They are not part of the current dependency set.
Introduce a new library only when there is a concrete requirement and the change is
worth the migration cost.

## Backend contract

The backend is ASP.NET Core 8. The Web API mapping must follow the actual
`src/api/services.ts` contract and backend controllers.

Important current endpoints include:

- Auth
  - `POST /api/auth/login`
  - `GET /api/auth/me`
  - `POST /api/auth/refresh`
  - `POST /api/auth/logout`
  - `POST /api/auth/change-password`
- Patients
  - `GET /api/patients`
  - `GET /api/patients/{id}`
  - `POST /api/patients`
  - `PUT /api/patients/{id}`
- Visits
  - `GET /api/visits`
  - `GET /api/visits/assigned-to-me`
  - `GET /api/visits/{id}`
  - `POST /api/visits`
  - `PUT /api/visits/{id}/close`
- Images
  - `GET /api/images`
  - `POST /api/images`
  - quality/content/void routes under `/api/images/{id}/...`
- Diagnoses
  - `POST /api/diagnoses/run/{imageId}`
  - `GET /api/diagnoses/{id}`
  - `GET /api/diagnoses/by-image/{imageId}`
  - `GET /api/diagnoses/{id}/lesion-mask`
  - `GET /api/diagnoses/{id}/fractal-image`
  - `GET /api/diagnoses/progression/{patientId}`
- Triage
  - `GET /api/triage`
  - `GET /api/triage/count`
  - `POST /api/triage/{id}/approve`
  - `POST /api/triage/{id}/override`
- Reception
  - `/api/reception/on-duty`
  - `/api/reception/shifts...`
- Admin
  - `GET /api/admin/dashboard`
  - `/api/admin/configs...`
  - `/api/admin/models...`
  - `GET /api/admin/audit`
- Export
  - `/api/export/...`

When in doubt, use `src/api/services.ts` and the backend controller code as the
authoritative contract instead of inventing endpoint names.

## Roles

Current role names:

- Admin
- Doctor
- Receptionist
- Patient

The backend now uses `Roles` + `UserRoles`, and one user may possess multiple active
roles. The Web normalizes `role` + `roles[]` for backward compatibility.

Frontend route/menu checks must use helpers from:

- `src/lib/roles.ts`
- `src/lib/permissions.ts`

Backend authorization remains authoritative.

Important Web landing behavior:

- Admin → `/dashboard`
- Doctor → `/triage`
- Receptionist → `/reception/visits/new`
- Patient → not a normal Web-console destination

## Folder structure (current)

```text
src/
  api/
    client.ts
    services.ts
  app/
    App.tsx
  components/
    AppShell.tsx
    charts.tsx
    ProtectedImage.tsx
    ui.tsx
  config/
    index.ts
  contexts/
    AuthContext.tsx
    DataContext.tsx
    ToastContext.tsx
  lib/
    enums.ts
    format.ts
    hooks.ts
    permissions.ts
    roles.ts
  pages/
    AdminPages.tsx
    AuthPages.tsx
    DoctorVisitsPage.tsx
    EngagementPages.tsx
    FundusPage.tsx
    PatientDetailPage.tsx
    PatientsPage.tsx
    ProgressionPage.tsx
    ReceptionPages.tsx
    RecheckPage.tsx
    TriagePage.tsx
    UsersPage.tsx
    VisitReportPage.tsx
  styles/
    app.css
  types/
    api.ts
  routes.tsx
```

`AppointmentsPage.tsx` may remain as an unused legacy file, but new work must follow
the current no-timeslot-appointment business flow unless routes/code explicitly bring
that workflow back.

## API configuration

Web runtime configuration is intended to work as:

```text
public/config.js
  -> window.__DIACOMPANION_API__
  -> src/config/index.ts
  -> API_BASE
  -> api/client.ts
```

Do not hard-code backend URLs in pages or API services.

Note: if `src/config/index.ts` still returns only `DEFAULT_API`, make the minimal fix to
use `window.__DIACOMPANION_API__ || DEFAULT_API`. This is a deployment wiring fix, not a
business rewrite.

## Auth & session

The current browser implementation stores the JWT in `sessionStorage` via `tokenStore`.
Do not silently rewrite the project to an in-memory-only or secure Electron store unless
that work is explicitly scheduled.

Every API call attaches `Authorization: Bearer <token>` through the shared client.

A 401 dispatches the global unauthorized event handled by the auth layer.

`MustChangePassword` is enforced by routing/middleware. Forced first password change
does not require the current password when the backend marks the account accordingly.

## Data access

Pages should continue to access backend operations through `DataContext` / API services,
not scattered raw `fetch()` calls.

Use `useAsync` and `useDebounce` consistently with the current architecture unless a
specific migration to another server-state library is approved.

## Build order for incremental changes

1. Keep the current CSS/token visual language stable.
2. Keep auth + role normalization working.
3. Verify staff route gating for all active roles.
4. Verify patient creation and new `MedicalRecord`/`UserRole`-aware backend contracts.
5. Verify reception visit creation.
6. Verify triage / diagnosis / review.
7. Verify admin/governance.
8. Verify deployment runtime config.
9. Electron packaging only after browser behavior is stable.

## Enforcement

- Do not invent a Nurse role.
- Do not convert the patient app to Flutter in documentation or code.
- Do not invent old endpoint names such as `/api/aidiagnosis/...`.
- Do not replace the current component/state stack solely to match an architectural
  preference document.
- Clinical writes are never optimistic.
- Role checks in the client are convenience/UX checks; backend authorization is final.
