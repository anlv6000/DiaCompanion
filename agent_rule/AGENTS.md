# AGENTS.md — DiaCompanion Web (clinical console)

Build conventions for AI coding agents. **Read `DESIGN.md` before generating any UI.**
This file governs *how the code is built*; `DESIGN.md` governs *how it looks*.

## Scope

Web console for **doctor + admin** roles only. Patients use a separate Flutter app —
do not build patient mobile screens here. This app is packaged into **Electron** as
the LAST step; build and verify everything in the browser first.

## Stack (fixed)

- **Vite + React 18 + TypeScript**
- **Tailwind CSS**, mapped to `DESIGN.md` tokens via CSS variables (see below)
- **shadcn/ui** for component primitives (Radix under the hood) — **restyled to the
  tokens, never shipped with the default zinc/slate theme** (that default IS the slop)
- **TanStack Query** for all server state (pairs with the REST backend)
- **React Router** for routing + role gating
- **Recharts** for standard charts; **visx/d3** only for the custom risk–coverage curve
- **OpenSeadragon** (or a canvas layer) for the zoomable fundus viewer + lesion overlays
- **lucide-react** for icons (one set, no emoji)
- **@fontsource/ibm-plex-sans**, **-mono**, **-serif** for fonts (self-hosted → works offline in Electron)

Do not add MUI or Ant Design — their default look is exactly what we are avoiding.

## Backend (already built)

- Base URL: `http://localhost:5080`, Swagger at `/swagger`.
- Auth: `POST /api/auth/login` → JWT. Send `Authorization: Bearer <token>` on every call.
- Role-gate routes by the `role` claim (Admin / Doctor / Nurse).
- Key endpoints (full map in the backend README):
  - Triage queue: `GET /api/aidiagnosis/triage`
  - Run AI: `POST /api/aidiagnosis/run/{fundusImageId}`
  - Progression: `GET /api/aidiagnosis/progression/{patientId}`
  - Approve/Override: `POST /api/reviews/{aiDiagnosisId}`
  - Disagreement export: `GET /api/reviews/conflicts`
  - Dashboard: `GET /api/dashboard/stats`

## Folder structure

```
src/
  app/                 # app shell, providers (QueryClient, Router, Auth)
  routes/              # route definitions + role guards
  features/
    auth/              # login, token store, role gating
    triage/            # worklist (DEFAULT view)
    diagnosis/         # fundus viewer + lesion overlay + AI run
    review/            # approve/override panel + risk-coverage curve
    progression/       # DR + fractal + HbA1c timeline
    patients/          # search, record
    monitoring/        # glucose/HbA1c/BP (read views for doctor)
    admin/             # staff, system config, model versions
  components/ui/       # shadcn primitives, restyled to tokens
  lib/api/             # typed fetch client + query hooks
  lib/auth/            # jwt handling, useRole()
  styles/tokens.css    # CSS variables from DESIGN.md
tailwind.config.ts     # maps token vars → Tailwind theme
```

## Token wiring

Put every `DESIGN.md` color/space/radius into `styles/tokens.css` as CSS variables,
then reference them from `tailwind.config.ts`. Components use Tailwind classes that
resolve to tokens — no hard-coded hex anywhere in components.

## Auth & security

- Store the JWT in memory; in the Electron build use secure storage, not localStorage.
- Attach the bearer token via a single fetch wrapper in `lib/api`.
- Guard routes by role; a Nurse must not reach admin config.

## Electron packaging (LAST step)

- Use **electron-vite**. Renderer loads the built static bundle.
- Secure defaults: `contextIsolation: true`, `nodeIntegration: false`, preload bridge
  for any native needs. Fonts self-hosted so the app renders offline.

## Build order (small, verifiable steps — do NOT skip ahead)

1. `styles/tokens.css` + `tailwind.config.ts` + fonts + one restyled shadcn button/badge
   to prove the token pipeline (screenshot check against `DESIGN.md`).
2. App shell + routing + login wired to `/api/auth/login` + role gating.
3. **Triage worklist** (default view) from `/api/aidiagnosis/triage` — dense table,
   severity chips, deferred badges, correct default sort. Include loading/empty/error states.
4. Fundus viewer + lesion overlay + `POST .../run`.
5. AI review panel (Approve/Override → `/api/reviews`) + risk–coverage curve.
6. Progression panel from `/api/aidiagnosis/progression`.
7. Remaining modules (patients, monitoring read views, admin config, dashboard).
8. Electron wrapper.

Each step must run in the browser and be reviewed before the next.

## Enforcement

- If a generated screen violates the **Anti-slop** or **Clinical UX safety** sections
  of `DESIGN.md`, treat it as a bug and redo it — those sections override "looks fine".
- Never finalize a diagnosis in the UI without a human action.
- Never encode status by color alone.
