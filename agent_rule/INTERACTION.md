---
name: DiaCompanion Interaction & Behavior Standards
scope: Frontend behavior only — timing, state, feedback, input handling
companion_files:
  - DESIGN.md    # visual language (colors, type, spacing) — NOT repeated here
  - AGENTS.md    # stack, folder structure, build order

timing_ms:
  debounce_search: 250        # text input -> server query
  debounce_filter: 0          # dropdown/checkbox changes fire immediately
  throttle_scroll: 100
  instant_feedback: 100       # UI must acknowledge any click within this
  skeleton_after: 300         # show skeleton only if load exceeds this
  toast_duration: 4000
  toast_duration_error: 8000  # errors stay longer; destructive errors are sticky
  optimistic_rollback: 0      # revert immediately on failure, then explain

pagination:
  default_page_size: 25
  page_size_options: [10, 25, 50, 100]
  strategy: server_side       # this app's datasets are unbounded
  client_side_threshold: 1000 # below this, sort/filter locally without a round trip
  virtualize_above: 1000
  show_total: true            # "1–25 / 312" — a sense of place
  reset_page_on: [filter_change, sort_change, search_change]
  preserve_across_pages: [filters, sort, search, page_size]

table:
  row_height_px: 34           # dense (see DESIGN.md)
  fixed_width_columns: [status, badges, dates, numeric_metrics, actions]
  flex_columns: [name, description, note]
  sortable_headers: true
  sort_indicator: always_visible_on_hover
  row_hover: true
  sticky_header: true
  selection: checkbox_column_when_bulk_actions_exist

url_state:
  sync: [search, filters, sort, page, page_size, active_tab]
  method: query_params        # HashRouter -> /#/patients?q=an&page=2&sort=-updated

forms:
  validate_on: blur           # never on every keystroke
  revalidate_on: change       # only AFTER a field has errored once
  submit_disabled_while_pending: true
  preserve_input_on_error: true
  autofocus_first_field: true
  autofocus_first_error_on_submit: true
---

## Purpose

`DESIGN.md` says what the app **looks like**. This file says how it **behaves**:
how fast it responds, when it fetches, what happens while waiting, what happens
when it fails. Visual tokens are settled — do not restate or override them here.

The governing idea: this is a **worklist tool used under time pressure by clinicians**.
Every interaction should reduce the number of deliberate actions required. If the
system can figure out what the user wants from what they already typed or clicked,
it must not also demand a button press.

## 1. Live interaction — no "Apply" buttons

**Search is as-you-type.** Text inputs that filter or query fire automatically after
a **250ms debounce** — the user never presses a search button. Debounce exists to
protect the backend, not to make the user wait: below ~200ms requests spam the
server, and past ~300ms the UI starts to feel like it is ignoring input. 250ms sits
in that window.

**Dropdowns, checkboxes, toggles, and date pickers apply immediately** (no debounce,
no confirm). A discrete choice is already an explicit action; making the user confirm
it twice is friction.

**Sorting is instant.** Clicking a column header re-sorts without a page reload and
without a confirm step. Sort direction is shown in the header at all times (not only
after clicking).

The only inputs that still require an explicit submit are **forms that write data**
(create patient, prescribe, override a diagnosis) — because those have consequences.

### Race conditions are mandatory to handle

As-you-type search will produce out-of-order responses: a request for `an` may return
*after* the request for `anh`, painting stale results over fresh ones. Every
auto-firing request must therefore either be aborted when superseded (`AbortController`)
or carry a request id that is checked before its result is committed to state.
Silently rendering stale results is a bug, not a cosmetic issue.

### Never blank the screen while re-querying

When a search or filter re-runs, **keep the previous rows visible** and dim them
slightly (or show a thin progress line at the top of the table). Do not clear to an
empty state and do not swap in a full-page spinner — the list flickering and jumping
is what makes search feel slow, even when the backend is fast.

## 2. Pagination

Use **server-side pagination** for every list in this app. Do not use infinite scroll:
it suits discovery feeds, whereas clinical worklists are task-oriented tables where
users need orientation, a stable position, predictable performance, and accessibility.

- **Default 25 rows**, selectable 10 / 25 / 50 / 100.
- Always show **range and total** (`1–25 / 312`). A total count gives a sense of place.
- **Reset to page 1** whenever the search, a filter, or the sort changes — otherwise
  the user can land on a page that no longer exists in the new result set.
- **Preserve filters, sort, and page size across page changes.** Changing page must
  never silently drop the user's filters.
- Keep pagination controls in a fixed position so they don't jump between pages.
- Past ~1000 rows in a single continuous view, **virtualize** rather than paginate wider.

**Sorting/filtering location:** if the loaded set is under ~1000 rows and already in
memory, sort and filter **client-side** (zero latency). Beyond that, go server-side.
Never mix silently — a sort that only reorders the current page while claiming to sort
the whole set is misleading.

## 3. Loading & feedback

**Acknowledge every action within 100ms** — button enters a pressed/disabled state,
row highlights, spinner appears inside the control. Never let a click produce zero
visible change.

**Skeletons, not spinners, for content** — and only after **300ms**. Faster responses
should render directly; flashing a skeleton for 80ms is worse than showing nothing.
Skeletons must match the shape of the incoming content (table rows for a table), so
the layout does not shift when data arrives.

**Inline spinners for actions** (saving, running AI, approving) go *inside* the
triggering control, not over the whole page. The rest of the screen stays usable.

**Long operations get progress, not a frozen screen.** AI inference and exports show
what stage they are in. If an operation may exceed ~10s, say so before it starts.

**Never block the whole page** with a modal loading overlay unless the app genuinely
cannot continue (session expiry).

## 4. Optimistic updates — and where they are forbidden

For **low-risk, reversible, high-frequency** actions, update the UI immediately and
reconcile with the server afterwards: marking a notification read, toggling a lesion
overlay layer, changing page size, dismissing a reminder. On failure, revert
immediately and show a non-blocking error with a retry.

**Optimistic updates are FORBIDDEN for clinical writes.** Approving or overriding an
AI result, entering a conclusion, prescribing, voiding a record — these must show a
pending state and only reflect success **after the server confirms**. A clinician must
never see "approved" for something the server rejected. This follows directly from the
safety rule in `DESIGN.md`: the human decision is the source of truth, so the UI must
not fabricate it.

## 5. URL is state

Search text, filters, sort, page, page size, and the active tab live in **query
parameters**. Consequences: refreshing keeps the view, a filtered worklist can be
copied to a colleague, and browser back/forward work as expected. A doctor who filters
to deferred cases, opens one, and presses Back must land on the same filtered list at
the same page — losing their filters is a defect.

Row detail navigation must **preserve scroll position** on return.

## 6. Forms

Validate on **blur**, never on every keystroke — erroring at character three of an
email the user is still typing is hostile. Once a field has errored, re-validate on
change so the error clears as soon as it is fixed.

- Keep the submit button enabled-looking until pressed; on submit, disable it and show
  a pending state so double-submit is impossible.
- On failure, **never wipe the user's input**. Repopulate everything and focus the
  first invalid field.
- Show the specific problem, not "invalid input" — say which field and why.
- Required fields are marked; units and expected formats are shown *before* the error
  (e.g. `mmol/L`, `dd/mm/yyyy`).
- **Warn before discarding unsaved changes** when navigating away from a dirty form.
- Destructive or irreversible actions (void a record, deactivate an account, activate a
  new model version) require explicit confirmation naming the specific object —
  "Void chẩn đoán #142?" not "Are you sure?". Void additionally requires a reason.

## 7. Keyboard & focus

Everything reachable by mouse is reachable by keyboard, in a logical tab order.

- `/` focuses the main search field of the current view.
- `↑`/`↓` move the selection in a worklist; `Enter` opens the selected row.
- `Esc` closes dialogs, popovers, and inline edit states.
- Dialogs **trap focus** while open and **return focus** to the trigger on close.
- Focus is never lost to `<body>` after an action — after closing a row detail, focus
  returns to that row.
- Focus rings are always visible for keyboard users (see `DESIGN.md`); never
  `outline: none` without a replacement.

## 8. Accessibility (non-negotiable, not a phase-2 task)

- Use semantic `<table>`/`<th scope>` for tabular data — not stacks of `<div>`s.
- Sortable headers expose `aria-sort`; sort changes are announced.
- Async region updates (search results, queue refresh) use a polite live region so
  screen readers hear "24 results" rather than nothing.
- Every icon-only control has an accessible label; icons alone never carry meaning.
- Status is never conveyed by color alone — icon + text as well (already required by
  `DESIGN.md`, restated because it is an *interaction* rule too).
- Respect `prefers-reduced-motion`: skip transitions, keep state changes instant.
- Interactive targets are at least 32×32px in dense mode, 44×44px on touch.

## 9. Errors & empty states

Every data surface defines four states — loading, empty, error, and populated — before
it ships. In addition:

- **Errors are recoverable in place**: show what failed, why, and a retry control.
  Never dead-end the user on a page with nothing but red text.
- **Distinguish "no data yet" from "no results for this filter."** The second offers a
  "clear filters" action; the first explains how to create the first record.
- **Do not lose work on failure.** A failed prescription submit keeps the drafted items.
- **Session expiry** is handled globally: pause, explain, offer re-login, and return the
  user to where they were — never dump them to an empty login screen mid-task.
- If the connection is poor, keep the last good data visible with a "may be out of date"
  note rather than clearing to a blank screen that looks like failure.

## 10. Performance budgets

- Interaction to visible feedback: **< 100ms**.
- Filter/sort on already-loaded data: **< 200ms**, no server round trip.
- Table renders 25 rows without jank; virtualize past 1000.
- Do not refetch on every mount — cache per view and refresh on demand or on write.
- Charts render from data already in state; they never trigger their own fetch.
- Avoid layout shift after load: reserve height for tables, charts, and images.

## Anti-patterns — reject these

- A **"Search" / "Apply filters" button** next to inputs that could just fire themselves.
- **Clearing the table to a spinner** on every keystroke, so the list flickers.
- **Losing filters, sort, or page** after opening a row and coming back.
- **Full-page loading overlays** for a single-row action.
- **Optimistic clinical writes** — showing "Approved" before the server said so.
- **Infinite scroll on a clinical worklist**, where position and totals matter.
- **Sorting that only reorders the current page** while implying it sorted everything.
- **Wiping a form** on a validation error.
- **`window.confirm` / `alert`** for destructive actions — use a real dialog that names
  the object and captures a reason.
- **Toasts as the only channel** for an important error; if it needs action, it stays
  on screen.
- **Disabled buttons with no explanation** of what would enable them.
