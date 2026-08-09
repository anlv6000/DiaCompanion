---
name: DiaCompanion Clinical Console
platform: Web (doctor/admin) — later packaged in Electron
mode: light (data surfaces) + one dark neutral surface (fundus viewer only)
personality: [clinical, dense, calm, editorial, trustworthy]

colors:
  # neutrals — cool, calm clinical (never pure white / never #000)
  canvas:        "#F7F8FA"   # app background
  surface:       "#FFFFFF"   # panels
  hairline:      "#E2E5EA"   # 1px borders (use INSTEAD of drop shadows)
  ink:           "#1A1D23"   # primary text
  ink-muted:     "#5A6270"   # secondary text
  ink-faint:     "#8A909C"   # labels, meta

  # single confident accent — deep teal (NOT default blue, NOT purple)
  primary:        "#0E7C86"
  primary-active: "#0A5E66"
  focus-ring:     "#0E7C86"

  # the ONLY dark surface in the app
  fundus-canvas:  "#14171C"
  fundus-chrome:  "#1C2026"

  # DR severity — ordinal ramp, colorblind-safe (ColorBrewer YlOrRd family).
  # Normal is a NEUTRAL slate (absence of disease), grades 1-4 escalate warm.
  grade-0-normal:   "#54687A"
  grade-1-mild:     "#FED976"
  grade-2-moderate: "#FD8D3C"
  grade-3-severe:   "#E9522A"
  grade-4-pdr:      "#B10026"

  # deferral (Gap 2 — the star). Distinct indigo: "uncertain, hand to human".
  # NOT alarm-red (deferral is not danger, it is uncertainty).
  defer:     "#5A4FCF"
  defer-bg:  "#ECEAFB"

  # semantic alerts — ALWAYS paired with icon + text (colorblind redundancy)
  risk-ok:    "#1B7F5A"
  risk-watch: "#B77800"
  risk-alert: "#C0362C"

typography:
  ui:      { family: "IBM Plex Sans",  weights: [400, 500, 600] }
  mono:    { family: "IBM Plex Mono",  weights: [400, 500] }   # IDs, metrics, %, timestamps, grade codes
  display: { family: "IBM Plex Serif", weights: [500] }        # large section titles only (editorial character)
  scale_px: [11, 12, 13, 14, 16, 20, 28]   # 13 = dense table body; 14 = default body
  numerals: tabular   # tables & metrics use tabular figures

spacing_px: [2, 4, 8, 12, 16, 24, 32, 48]   # 4-base, dense

radius_px:
  xs: 2
  sm: 4
  md: 6
  lg: 8        # HARD CAP — no 12/16px pillowy cards

elevation:
  default: "1px solid hairline"     # panels use borders, not shadows
  overlay: "0 4px 16px rgba(20,23,28,0.12)"   # ONLY for menus/dialogs/popovers

motion:
  duration_ms: [120, 160, 200]
  easing: "ease-out"          # no bouncy spring in a clinical tool
  reduced_motion: respected

icons: "one line-icon set (Lucide or Phosphor) — never emoji, never mixed sets"
---

## Overview

This is the **Web clinical console** for doctors and admins in DiaCompanion — a
diabetic-retinopathy (DR) screening system. Patients use a separate Flutter mobile
app; **do not** design patient-facing mobile screens here.

The product is a **worklist tool**, not a marketing surface and not a generic admin
dashboard. It is organized around one question: *"which case needs me now?"* — like a
radiology PACS worklist, not a stats homepage. Optimize for **information density,
fast triage, and making model reliability visible**. Density beats whitespace here.

## Design principles

1. **Triage-first.** The default screen is the case queue (deferred → referable →
   high-disagreement first), never a chart grid.
2. **Reliability is a first-class citizen.** Confidence and cross-task disagreement
   are shown on-screen (including a risk–coverage curve), not buried in a table cell.
3. **AI assists, never decides.** Every AI output is decision support pending a human
   Approve/Override. The UI must never look like a final verdict.
4. **Commit to density.** Middle-ground spacing is where "AI slop" lives. This tool
   commits to the dense end.
5. **Content shapes layout.** No reflexive 3-column grid. A worklist is a dense table
   plus a detail rail — because that is what the content is.

## Color

**Neutrals** are cool and calm. The app background is a light cool gray (`canvas`),
panels are white, and panels are separated by **1px hairlines rather than drop
shadows**. This is the single biggest lever against a generic look.

**One accent only:** deep teal `primary`, reserved for the primary action and active
nav state. It is deliberately *not* on the DR severity ramp, so severity and
"interactive" never get confused.

**DR severity** is an **ordinal, colorblind-safe** ramp. Normal is a neutral slate
(disease absent); Mild→PDR escalate along a warm YlOrRd ramp. This ramp is used
**only** for DR grade — never reuse it for categories, tags, or charts.

**Deferral** (the research contribution, Gap 2) gets its own indigo `defer` token —
loud but not alarm-red, because deferral means *uncertain → route to a human*, not
*danger*. A deferred case is always visually marked and never hidden behind a tab.

**Semantic alerts** (ok / watch / alert) must **never rely on hue alone** — always
pair with an icon and a text label, and, where possible, position. Assume the reader
is colorblind.

## Typography

IBM Plex, not Inter. `IBM Plex Sans` for UI/body, `IBM Plex Mono` for anything a
clinician reads as data — patient IDs, grade codes, confidence %, fractal values,
timestamps — using **tabular figures** so columns align. `IBM Plex Serif` appears
only in large section titles to give an editorial, considered character; never in
body or controls. Type scale is tight (13px dense table body). Never introduce a
fourth family "because it looks clean".

## Spacing, elevation & shape

4px spacing base, dense rows. Radius is small (2–8px, hard cap 8) — **no pillowy
12–16px cards**. Panels are bordered, not shadowed; shadows exist only for true
floating overlays (menus, dialogs, popovers).

## Components

- **App shell:** left nav (icon + label, collapsible), top bar showing the signed-in
  role and an **active-model-version chip** (e.g. `efficientnet-b2-v4.2`), then content.
- **Triage worklist (default view):** dense table, ~34px rows. Columns: patient
  (mono ID + name), eye (OD/OS), DR grade (severity chip), confidence (mono %),
  disagreement (thin inline bar), **deferred badge (indigo)**, review status, updated.
  Default sort: deferred → referable → disagreement desc. Clicking a row opens the
  detail rail; the table stays visible.
- **Fundus viewer:** the app's only dark surface (`fundus-canvas`, not black).
  Zoom/pan, lesion-overlay toggle (MA/HE/EX/SE), red-free toggle, OD/OS side-by-side.
- **AI review panel:** a summary block (grade + confidence + disagreement + fractal +
  model version + timestamp) with an explicit **"Chưa xác nhận / Đã xác nhận"** state,
  and an **Approve / Override** control. Override reveals a grade selector + note.
  Prior reviews listed below.
- **Risk–coverage curve:** x = coverage, y = risk/error, with a draggable threshold
  marker. Restrained, at most two series, primary teal + muted reference.
- **Progression panel:** one time axis, DR grade (stepped) + fractal dimension (line)
  + HbA1c overlay — the combined longitudinal prognosis view.
- **Badges:** grade chip (severity ramp), `Referable` tag, `Deferred` badge (indigo),
  `Confirmed`/`Unconfirmed`.

## State-first (design these BEFORE the happy path)

Every data surface must define: **loading** (skeleton rows, never a centered spinner
on a full page), **empty** (a real "no cases in queue" state, not blank), **error**
(model/service failure is explained, retry offered), and **deferred** (a deferred case
looks different and is sorted to the top). A screen without these four states is unfinished.

## Motion

120–200ms ease-out. No bouncy spring, no decorative animation. Respect
`prefers-reduced-motion`. Motion clarifies state change; it is never ornament.

## Anti-slop — reject these defaults (they are YOUR reflexes, Claude)

When generating this UI, actively refuse the pre-trained path of least resistance:

- **No Inter / system-default as the type choice.** Use the IBM Plex stack above.
- **No purple/indigo gradient backgrounds, no glowing "orbs" representing AI.** The
  only violet in this app is the flat `defer` semantic token. AI presence is shown by
  *data* (confidence, disagreement), never by decoration.
- **No pillowy rounded cards (12–16px) with soft drop shadows scattered everywhere.**
  Hairline borders + small radius. Shadows only on real overlays.
- **No reflexive three equal symmetric columns / card grid.** The core view is a dense
  table + detail rail.
- **No emoji as bullets or icons.** One line-icon set, used consistently.
- **No `#000000` dark mode.** The only dark surface is the fundus canvas (`#14171C`).
- **No random 5-color categorical palette for DR.** DR is ordinal → the sequential
  severity ramp, always.
- **No hero sections, no marketing air, no stock/AI illustrations.** This is a tool.
- **One primary action per view.** Everything else is quiet (ghost / hairline). Do not
  fill five teal buttons on one screen.

## Clinical UX safety (non-negotiable)

- AI output is **decision support**, never a verdict. Always render grade **with**
  confidence, disagreement, model version, timestamp, and a confirmed/unconfirmed state.
- **Deferral is always visible** and dominant when present. Never hide deferred cases.
- The system **never auto-finalizes** a diagnosis. `FinalGrade` is set only by a human
  Approve/Override action.
- **Colorblind redundancy:** never encode critical status by color alone — icon + text
  + position as well.
- Metrics always show **unit and reference range** (Glucose mmol/L, HbA1c %, BP mmHg).
- Patient IDs and timestamps in mono; **never silently truncate** an identifier.
- Irreversible actions (finalize override, deactivate account, activate a new model
  version) require explicit confirmation.
