---
name: DiaCompanion Clinical Console
platform: Web staff console (Admin / Doctor / Receptionist) — browser first, Electron wrapper later
patient_app: Separate React Native + Expo patient app
mode: light (data surfaces) + one dark neutral surface (fundus viewer only)
personality: [clinical, dense, calm, editorial, trustworthy]

colors:
  canvas:        "#F7F8FA"
  surface:       "#FFFFFF"
  hairline:      "#E2E5EA"
  ink:           "#1A1D23"
  ink-muted:     "#5A6270"
  ink-faint:     "#8A909C"

  primary:        "#0E7C86"
  primary-active: "#0A5E66"
  focus-ring:     "#0E7C86"

  fundus-canvas:  "#14171C"
  fundus-chrome:  "#1C2026"

  grade-0-normal:   "#54687A"
  grade-1-mild:     "#FED976"
  grade-2-moderate: "#FD8D3C"
  grade-3-severe:   "#E9522A"
  grade-4-pdr:      "#B10026"

  defer:     "#5A4FCF"
  defer-bg:  "#ECEAFB"

  risk-ok:    "#1B7F5A"
  risk-watch: "#B77800"
  risk-alert: "#C0362C"

typography:
  ui:      { family: "IBM Plex Sans",  weights: [400, 500, 600] }
  mono:    { family: "IBM Plex Mono",  weights: [400, 500] }
  display: { family: "IBM Plex Serif", weights: [500] }
  scale_px: [11, 12, 13, 14, 16, 20, 28]
  numerals: tabular

spacing_px: [2, 4, 8, 12, 16, 24, 32, 48]

radius_px:
  xs: 2
  sm: 4
  md: 6
  lg: 8

elevation:
  default: "1px solid hairline"
  overlay: "0 4px 16px rgba(20,23,28,0.12)"

motion:
  duration_ms: [120, 160, 200]
  easing: "ease-out"
  reduced_motion: respected

icons: "one consistent line-icon style; current implementation uses internal SVG icons"
---

## Overview

This is the **Web clinical/staff console** for **Admin, Doctor, and Receptionist**
roles in DiaCompanion. Patients use a **separate React Native + Expo mobile app**.

The product is a clinical operations/worklist tool, not a marketing surface.
Different roles have different landing views:

- Doctor → triage worklist.
- Admin → dashboard / governance.
- Receptionist → reception / visit creation workflow.

The Doctor workflow is triage-first; the overall Web console also contains reception,
patient management, monitoring read views, staff management, system configuration,
model governance, audit, reports, and engagement modules.

## Design principles

1. **Clinical-workflow first.** Doctor views prioritize the case queue; receptionist
   views prioritize patient/visit intake; admin views prioritize governance.
2. **Reliability is visible.** Confidence, disagreement, deferral, model version, and
   review state should be visible where the backend provides them.
3. **AI assists, never decides.** AI output remains decision support until a Doctor
   approves or overrides it.
4. **Dense over decorative.** Favor compact tables, panels, detail rails, and small
   spacing rather than dashboard-card sprawl.
5. **Content shapes layout.** Use table + detail rail, forms, or focused panels when
   those structures fit the workflow.

## Color

Keep the current cool clinical neutrals and hairline-panel treatment. Use deep teal as
the primary interactive accent.

The DR severity ramp is reserved for grade 0–4. Deferral uses the dedicated indigo
token and must remain visually distinct from danger/error.

Critical statuses must not rely on color alone; pair color with text and, where useful,
an icon or stable position.

## Typography

Use the IBM Plex stack already represented in the Web styling:

- IBM Plex Sans — UI/body.
- IBM Plex Mono — identifiers, metrics, percentages, timestamps, codes.
- IBM Plex Serif — large section/report titles only.

If the runtime cannot load a Plex face, a reasonable fallback may be used, but do not
introduce a competing fourth primary font family.

## Spacing, elevation & shape

Use the 4px spacing rhythm, small radii (hard cap 8px for normal panels), bordered
surfaces, and shadows only for real overlays such as dialogs and toasts.

## Current component model

The current Web does **not** require Tailwind/shadcn/Recharts/OpenSeadragon/Lucide.
It uses:

- custom components in `src/components/ui.tsx`;
- custom SVG icons in the same component layer;
- custom CSS in `src/styles/app.css`;
- lightweight SVG charts in `src/components/charts.tsx`;
- Context-based state and API access.

Do not rewrite these solely to satisfy a library preference. New dependencies should be
introduced only when a concrete feature cannot be implemented cleanly with the existing
component layer.

## Core views

### Triage worklist

Current route: `/triage`, Doctor only.

Dense worklist with patient, eye, DR grade, confidence, disagreement, deferral,
referral need, assigned doctor, and timestamp. Selecting a row keeps the queue visible
and opens the review rail.

Triage uses **keyset/cursor pagination**, not numbered page pagination.

### Fundus viewer

Current route: `/fundus/:imageId`, Doctor only.

The viewer supports the current clinical image workflow, including original image,
AI-generated mask/derived views, zoom/pan where implemented, and diagnosis/review
context. Preserve the dark fundus surface as the only intentionally dark application
surface.

Do not require OpenSeadragon unless the existing viewer can no longer meet the needed
zoom/pan behavior.

### AI review

Doctor-only review supports Approve / Override and must wait for server confirmation.
Display AI grade with confidence, disagreement, fractal value, model version, timestamp,
and deferral information when available.

### Progression

Use the current progression DTO/data and lightweight chart implementation unless a new
requirement justifies replacing it.

### Reception workflow

Receptionist views are a first-class part of this Web console. They include patient
lookup/creation, visit creation, and doctor-shift/on-duty workflows.

### Admin workflow

Admin views include dashboard, staff accounts, configs, model versions, conflicts/export,
audit, and other governance functions exposed by the current backend.

## State-first

Each significant data surface should support loading, empty, error, and populated states.
Deferred state is additionally important for AI triage surfaces.

The existing `LoadState` component and skeleton rows are the baseline implementation.
Improvements may be made incrementally; do not require a large state-management rewrite.

## Clinical UX safety

- Never show an AI result as a final verdict before Doctor review.
- Deferral must remain visible.
- Clinical writes are confirmed by the backend before the UI reports success.
- Metrics should show units where the DTO/backend provides them.
- Do not silently truncate identifiers.
- Void/deactivate/model activation and similar high-impact actions use explicit
  confirmation; void actions require a reason when the backend requires one.
- Backend authorization remains the source of truth; frontend role checks are UX guards.

## Anti-slop

Retain the original anti-slop direction:

- no decorative gradients/orbs;
- no giant rounded cards;
- no marketing hero sections;
- no color-only clinical meaning;
- no arbitrary categorical reuse of the DR severity ramp;
- no unnecessary component-library rewrite just for visual fashion.
