---
name: DiaCompanion Interaction & Behavior Standards
scope: Current Web frontend behavior and incremental UX targets
companion_files:
  - DESIGN.md
  - AGENTS.md

timing_ms:
  debounce_search_current_default: 300
  debounce_filter: 0
  instant_feedback_target: 100
  toast_duration_target: 4000

pagination:
  normal_lists:
    strategy: server_side_page_number
    default_page_size: 25
  triage:
    strategy: keyset_cursor
    default_page_size: 25

forms:
  submit_disabled_while_pending: true
  preserve_input_on_error: true
---

## Purpose

This file describes behavior standards **without requiring a rewrite of the current
frontend architecture**.

The implementation currently uses React local state, Context, `useAsync`, `useDebounce`,
custom tables/modals, and backend pagination. Preserve that architecture unless a
separate migration is approved.

## 1. Search and filters

Search should remain as-you-type where the current page already uses `useDebounce`.
The shared hook currently defaults to **300ms**. Do not force a change to 250ms only to
match documentation.

Dropdowns and explicit discrete filters may apply immediately.

The current `useAsync` effect cleanup prevents a superseded request from committing its
result after dependencies change. This is acceptable race protection for the current
architecture; `AbortController` is optional rather than mandatory.

## 2. Pagination

Do not impose one pagination mechanism on every dataset.

### Standard lists

Patient/staff/recheck and similar bounded table APIs may use numbered server-side
pagination with backend metadata such as `page`, `pageSize`, `totalItems`,
`totalPages`, and `rangeLabel`.

### Triage

The triage queue intentionally uses **keyset/cursor pagination**:

```text
GET /api/triage?...&cursor=...&size=25
```

This helps avoid skipping/reordering issues as new clinical cases enter the queue.
Keep the current Previous / Load next behavior unless the backend contract changes.

Do not document triage as page-number pagination.

## 3. Loading and feedback

The current baseline uses `LoadState` + skeleton rows and inline busy states.

It is acceptable for a re-query to show the current skeleton behavior. Keeping prior
rows visible during background refresh is a future enhancement, not a requirement that
justifies a state-management rewrite.

Action buttons should disable while pending where implemented. Clinical actions must
not show successful state until the backend confirms success.

## 4. Optimistic updates

Optimistic UI is acceptable only for low-risk reversible actions.

Do **not** optimistically finalize:

- AI approve/override;
- prescriptions;
- visit close;
- void/revoke operations;
- account activation/deactivation;
- model activation.

These wait for the backend response.

## 5. URL state

The current application uses **`BrowserRouter`**, not `HashRouter`.

Pages currently keep much search/filter/pagination state in local React state. Query
parameter synchronization is an optional incremental improvement, not a mandatory
requirement for every existing screen.

Do not rewrite all screens simply to put every filter into the URL.

For navigation changes that are made in the future, preserve context when practical
(e.g. selected patient/visit or useful search state).

## 6. Forms

Retain the current form behavior unless a specific form has a UX defect.

General expectations:

- prevent double-submit while pending;
- keep entered values after validation/API failure;
- show specific backend validation messages;
- require explicit confirmation for destructive/high-impact actions;
- capture a reason when the corresponding backend void action requires one.

Validation-on-blur is preferred for new forms but is not a requirement to refactor every
existing form.

## 7. Keyboard and accessibility

Maintain semantic tables and accessible labels where already present.

Incremental accessibility improvements are welcome, but do not treat the following as
already implemented unless verified in code:

- global `/` search shortcut;
- arrow-key worklist navigation;
- complete focus trapping/return for every modal;
- `aria-sort` on every sortable table;
- live-region announcements for every async update.

These are enhancement targets rather than current guarantees.

## 8. Errors and empty states

Use the existing `LoadState`, toast, field-error, and confirmation patterns.

Distinguish API errors clearly and keep forms usable after failure. `api/client.ts`
already parses ASP.NET validation errors and exposes useful messages.

A 401 is handled globally through the unauthorized event and AuthContext.

## 9. Performance

Current goals:

- 25-row server-paged tables should render without jank.
- Debounced search should avoid request spam.
- Triage remains keyset-paged.
- Avoid adding heavyweight libraries unless they solve a measured problem.
- Charts use data already loaded through the current page/context flow.

## 10. Connectivity

When the hospital backend is temporarily unavailable, Web/API requests may fail and the
UI should explain that the backend cannot be reached.

The patient mobile app may likewise be unavailable when the hospital has no Internet
connection; this is an accepted deployment characteristic, not a frontend sync defect.

## Anti-patterns

- hard-coded production API URLs scattered through pages/services;
- optimistic clinical writes;
- claiming a role/feature exists when backend authorization does not support it;
- rewriting the whole frontend to Tailwind/TanStack/shadcn solely because older docs
  named those libraries;
- documenting HashRouter when the app uses BrowserRouter;
- documenting page-number pagination for triage when it uses keyset pagination.
