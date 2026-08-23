# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## What this is

"Daily" is a personal, single-user PWA for a Dubai real estate agent (Mustafa Saleh, Allegiance Real Estate) to track daily activity targets, a commission goal (`TARGET`/`DEADLINE` in `index.html`), a deals pipeline, property inventory, off-plan projects, a diary/calendar, and market comps. There is no backend, no build step, and no package manager — it's static files served as-is.

## Files

- `index.html` — the entire application. One file: all CSS in `<style>`, all markup in `<body>`, all JS in one `<script>` at the bottom. This is where ~all work happens.
- `sw.js` — service worker for offline caching (cache-then-network, falls back to cached `index.html` for navigation). See "Versioning" below for when to bump `CACHE`.
- `manifest.json` — PWA manifest (icons, theme colors, standalone display).
- `comps.json` — static market benchmark data (community medians, psf, recent trades) consumed by the Stock → Comps view. Edited as data, not code.
- `daily-restore-v30.json` — a large data export/backup snapshot, not source code. Don't treat it as something to maintain; it's an artifact of the app's own backup feature (see below).
- `apple-touch-icon.png`, `icon-192.png`, `icon-512.png` — PWA icons.

## Running / testing

No build, no test suite, no linter. To work on this locally:

```bash
python3 -m http.server 8000   # or any static file server
```

Open `http://localhost:8000/`. Because of the service worker, hard-refresh (or unregister the SW in devtools) after changes. There's an in-app "New version ready · Reload" pill (`#upd`) driven by SW `updatefound`/`controllerchange` — this is the update UX to preserve if you touch that logic.

Verify changes by opening the page in a browser and exercising the relevant tab (Today / Deals / Stock / Diary / More) — there's nothing else to run.

## Versioning (do this on every `index.html` change)

The user commits via GitHub Desktop, not `git` commands — never run git commands yourself; just edit files.

There's no build/deploy pipeline, so version bumps are manual and must stay in sync in three places whenever `index.html` changes:

1. `var APPVER=` near the top of `drawObj`'s neighborhood (currently `'v30 · 14 Aug 2026 · today cleaned up'`) — bump the version number, update the date, and write a short description of the change.
2. `drawStore()` — the "Storage" section's innerHtml hardcodes the version number as literal text twice (the "App version" row's hint, e.g. "If this is not v30..." and its `<div class="val hit">v30</div>`). These are **not** derived from `APPVER` — update the `v30` literals by hand to match.
3. `CACHE=` in `sw.js` (currently `'daily-v28'`) — bump so the service worker evicts old cached assets and returning users get the new file instead of a stale cached copy.

Keep the numeric part of `APPVER`/Storage in sync with each other; `sw.js`'s `CACHE` counter is separate/independent and just needs to increase, not match numerically.

## Architecture (all inside `index.html`'s script)

**State & persistence.** A single global object `S` is the entire app state (`deals`, `units`, `op` (off-plan), `diary`, `later`, `days` (per-day activity logs), `ledger` (commission entries), `trash`, `priv` (privacy/eye toggle), etc.), persisted whole to `localStorage` under key `K` (`'daily-v4'`). Writes go through `put(S)`, which debounces via `flushPut()` (220ms) rather than writing synchronously on every change — call `put(S)` after mutating `S`, don't write to `localStorage` directly. Large binary assets (unit photos, floorplans) live in IndexedDB (`idbOpen`/`idbGet`/`idbSet`/`idbDel`, DB `dailyimgs`), keyed via `imgKey(i,kind)`, because they're too big for `localStorage`.

**Backup/restore.** `buildBackup()` serializes `S` plus every IndexedDB image into one JSON blob (`{v, at, S, imgs}`) — this is the format of `daily-restore-v30.json`. Restore reverses this: writes images back to IndexedDB, replaces `S` wholesale, and reloads. If you add a new state array to `S`, add its default-empty-array initialization in both the startup block (~line 526) and the restore handler so old backups without that field don't produce `undefined`.

**Rendering.** No framework — direct `innerHTML` string-building per section, e.g. `drawHero()`, `drawDeals()`, `drawUnits()`, `drawMore()`, `drawCal()`. Each `draw*` function re-renders one section from `S`/`day` and is called explicitly after any mutation that affects it (there's no reactivity — if you add a new field that affects a view, find and call that view's `draw*` function). Tabs (`PAGE`) are five top-level pages (`today`, `deals`, `stock`, `diary`, `more`) toggled via `.hide` class in `goPage()`; sub-tabs within `stock` (units/offplan/comps) work the same way with `SSEG`. `pageDraw()` + the `DREW` memo object lazy-render a page's contents once the first time it's opened (`invalidate()` clears `DREW` to force a full re-render, e.g. after the privacy "eye" toggle).

**Today object.** `day` is a shorthand alias for `S.days[TD]` (today's ISO date) with defaults; activity counters (`calls`, `convos`, etc.) are bumped via `bump(k,d)` and only committed to `S.days[TD]` — and thus persisted — when the user taps "Save today".

**Domain constants live at the top of the script** (`TARGET`, `DEADLINE`, `NUMS`, `TOGS`, `STAGES`, `LOST`, `OBJ`, `PROB`, `DTYPES`, `CHEQ`, `SRCS`, `PAGES`, `TEMPLATES`, `FEES`, `LTVS`, `OPLANS`, etc.) — these encode real business rules (deal stage → win probability in `PROB`, Dubai transaction fee schedule in `FEES`, mortgage LTV tiers in `LTVS`, off-plan payment plan templates in `OPLANS`). Changing agent-specific numbers (commission target, deadline, fee assumptions) means editing these constants directly; there's no config layer.

**Calculators & documents.** The "More" tab's tool grid (`t-cost`, `t-mort`, `t-flip`, `t-plan`, `t-fee`, etc.) opens a shared modal (`openTool()` / `#tsheet`) that renders calculator-specific HTML and wires up its own `oninput` handlers per tool (`buyerCosts()`, `mortgage()`, `flipCalc()`, off-plan `opSchedule()`/`opWhats()`/`opVersus()`, `salesOffer()`, `rentalOffer()`). PDF/print output (`costPDF`, `flipPDF`, `opPDF`) builds HTML into `#printwrap` and calls `window.print()`; calendar export (`icsFile`, `icsAllLater`, `icsAllFollow`) builds `.ics` blobs client-side.

**No external dependencies.** No CDN scripts, no npm packages — everything (fonts fallback to system fonts, icons are inline SVG/unicode glyphs) is self-contained so the app works fully offline as a PWA.

## Conventions to preserve

- Terse/minified-style vanilla JS (`function(){}`, no semicolonless ASI reliance issues, single-letter locals like `d`, `i`, `k`) is the existing house style throughout — match it rather than introducing a more verbose style in new code.
- All state mutation flows through `S`, followed by `put(S)`, followed by calling the specific `draw*` function(s) whose section changed (see call sites after `.onclick`/`.oninput` handlers for the pattern).
- `esc()` must wrap any user-entered string interpolated into `innerHTML` (client names, notes, etc.) to avoid XSS via stored data.
- `pmoney()` (vs `money()`) respects the privacy/"eye" toggle (`S.priv`) that masks financial figures — use it for any new money display on the Today/Deals/Stock views.
