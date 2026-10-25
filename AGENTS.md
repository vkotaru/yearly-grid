# AGENTS.md

Technical guide to this repo, for coding agents and human contributors alike. For what it is and
how to install it, see [README.md](README.md).

## What this is

A Manifest V3 Chrome extension: a year-at-a-glance grid (12 months × 31 days) over the user's
Google Calendar, with calendar selection and editing. React 18 + Vite 6 + TypeScript + CSS
Modules. **No backend** — the extension page calls the Google Calendar REST API directly with a
token from `chrome.identity`.

## Commands

```bash
npm run dev        # UI in a normal tab with the mock backend (sample data, in-memory edits)
npm run watch      # rebuild dist/ on change; then reload the extension in chrome://extensions
npm run build      # typecheck (app + vite config) and build the unpacked extension into dist/
npm run typecheck
npm test           # vitest, run once
npx vitest run -t "layoutYear"   # a single test by name
```

Before committing: `npm run build && npm test`. Date logic is timezone-sensitive; run the tests
under a couple of zones when touching it, e.g. `TZ=Pacific/Auckland npm test`.

## Build and manifest

- `manifest.template.json` is the source; `vite.config.ts` writes `dist/manifest.json` from it,
  filling `oauth2.client_id` from `OAUTH_CLIENT_ID` and `key` from `EXTENSION_KEY` in `.env`.
  Both are tied to the developer's own Google Cloud project and extension ID, so they stay out of
  git. The build warns (doesn't fail) when they're missing.
- Two entry points: `index.html` (the grid page, opened in a tab) and `src/background.ts` (service
  worker, emitted as a fixed `background.js`). The worker only opens/focuses the page on toolbar
  click, using `runtime.getContexts` so no `tabs` permission is needed.
- Extension pages can't run inline scripts or load remote code (MV3 CSP) — keep everything bundled.

## Architecture (`src/`)

- `lib/dates.ts` — all day math uses **day numbers** (integer days since 1970-01-01 in the local
  calendar), never Dates at midnight, to avoid DST/timezone drift.
- `lib/events.ts` — Google event ↔ grid item and ↔ editor draft. The traps:
  - All-day `end.date` is **exclusive** (a one-day event on the 5th ends on the 6th).
  - Timed events ending exactly at local midnight don't occupy the next day on the grid; the
    editor still shows the real end date so an unchanged save round-trips.
  - Timed events are edited **in the event's own zones** (`start.timeZone`, `end.timeZone`), not
    the browser's, and written back in them — otherwise a save shifts the event in time. The grid
    itself places events on the viewer's local days.
  - Updates are full replacements (`PUT`). `useYearData.save` first GETs the event fresh, then
    `applyDraft` applies only the fields changed in the editor on top of it and sends `If-Match`
    with its etag — so fields the editor doesn't show (attendees, reminders, conference data…) and
    edits made elsewhere since the grid loaded are kept. `PATCH` would merge `start.date` with
    `start.dateTime` when switching all-day ↔ timed and be rejected.
  - Only plain events (`eventType` default) are editable; birthdays, out-of-office, working
    location etc. are view-only here.
- `lib/layout.ts` — greedy lane assignment across the whole year, so an event keeps its lane in
  every month row it touches; each month row is only as tall as its own events need.
- `lib/backend.ts` — the `Backend` interface. `lib/google.ts` implements it against the API (401 →
  drop the cached token and retry once); `lib/mock.ts` is the in-memory stand-in. `main.tsx`
  picks mock whenever `chrome.identity` is absent.
- `lib/storage.ts` — `chrome.storage.local` in the extension, `localStorage` under `npm run dev`.
  Holds the calendar list, the selected calendar IDs, and one cache entry per year.
- `useYearData.ts` — all state. Shows the cached year first, then refreshes from Google. Events in
  memory are tagged with their year and a `fresh` flag so a slow cache read can't overwrite newer
  network data and a fetch never merges into another year. A fetch that overlaps a local edit
  (`editsRef`) is redone so it can't revert the edit. A 401 that can't be renewed silently flips
  the UI to signed-out. Edits are **not queued offline**: the UI is read-only offline, and the
  cache is only ever updated from the API's response. Sign out sets a flag so the next launch
  doesn't silently sign back in.
- `lib/settings.ts` — view preferences (theme, accent, text size, event filter, sidebar). Kept in
  `localStorage`, not `chrome.storage`, because it's synchronous: `main.tsx` applies the theme
  before the first render so it doesn't flash. Theme is `data-theme` on `<html>`; accents are
  `--accent-light`/`--accent-dark` set inline from `ACCENT_COLORS`. `index.css` has the dark
  variables twice (OS-dark unless forced light, and forced dark) — keep the two blocks identical.
  The event filter applies in `App.tsx` before layout, so hidden events free their lanes.
- `components/YearGrid.tsx` — rendering, plus click/drag-to-create. The drag ref is written
  synchronously because the last `mouseenter` and the `mouseup` can land before a re-render.

## Google API notes

- Scopes: `calendar.calendarlist.readonly` (list calendars) and `calendar.events` (read/write
  events). Don't widen to `calendar` without a reason — it also grants calendar settings and ACLs.
- Changes don't set `sendUpdates`, so guests of an event aren't emailed when it's edited.
- `events.list` uses `singleEvents=true`, so recurring events arrive as instances; editing one
  edits only that instance. Moving an instance to another calendar isn't supported by the API, so
  the editor disables the calendar picker for instances.
- Event colours (`colorId`) use the palette in `EVENT_COLORS`, the shades the current Calendar web
  UI shows; the API's `/colors` endpoint returns older ones.
- `freeBusyReader` calendars are filtered out — they expose no event details.
