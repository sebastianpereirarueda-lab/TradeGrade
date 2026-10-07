# TradeGrade

Topstep-style trading stats dashboard with a journal and rule grading. Vite + React 18 + TypeScript,
Tailwind v4, Recharts, react-router (hash router). Local-first: state is in
`localStorage` via `src/lib/store.ts`; optional Supabase sign-in and sync when
`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are set at build time.

## Layout
- `src/lib/types.ts` – `Trade`, `DayJournal`, `Rule`, `Settings`, `AppState`.
- `src/lib/stats.ts` – pure stats engine (summary, buckets, grades, percentiles). Tested.
- `src/lib/importers/` – `rows.ts` shared header detection and row mapping; `csv.ts`,
  `xlsx.ts` (SheetJS), `pdf.ts` (pdf.js text positions -> grid); `index.ts` dispatches by
  file type and lazy-loads the heavy parsers. `grid.ts` routes a header+rows grid to the
  trade-list mapper or `orders.ts` (orders/fills export -> FIFO round trips, P&L via
  `src/lib/contracts.ts` point values, gross of fees). Tested.
- `src/lib/scorecard.ts` – GPA scorecards: metric catalog (`METRICS`), `gradePoints` (A target -> 4.0,
  F target -> 0.0, linear, either direction), weighted `scoreScorecard`, `weeklyGpa`. Discipline metrics
  are measured over traded days only. UI in `src/components/Scorecards.tsx`. Tested.
- `src/lib/store.ts` – persisted store, `useAppState()`, `actions`.
- `src/lib/media.ts` – journal attachments as Blobs in IndexedDB (`tradegrade-media`), hooks
  `useAttachments(date)` / `useAttachmentDates()`. Tested with fake-indexeddb.
- `src/components/Attachments.tsx` – drop / paste / pick media, voice-note recorder, lightbox.
- `src/lib/supabase.ts` (client or null), `auth.ts` (session hook + sign-in calls), `sync.ts`
  (one JSON row per user in `user_data`, debounced upsert, first-sign-in reconcile). Media mirrors
  to the `media` bucket + `attachments` table from `media.ts`. Schema: `supabase/schema.sql`.
- `src/pages/SignIn.tsx`, `src/components/AccountMenu.tsx` – only render when configured.
- `src/lib/sample.ts` – deterministic sample trades.
- `src/components/charts.tsx` – all Recharts charts. `gauges.tsx` – SVG gauges.
- `src/pages/*` – Dashboard, Calendar, Day, Rules, Import.

## Conventions
- Keep it simple and uncluttered; Topstep-style layout and data colours (green profit `#34c474`,
  red loss `#df4f4a`, neutral gray) over a fluid-art backdrop with frosted-glass cards. Colours and
  glass tokens live in `src/index.css`. The backdrop is generated, not stock: `src/assets/bg-fluid*.webp`
  from `scripts/background/` (shader, seed 13). Keep cards readable: glass opacity ≥ 0.66, opaque
  fallback for no-blur, reduced-transparency and high-contrast.
- All metric math lives in `src/lib/stats.ts` as pure functions with tests; pages only
  compose them. P&L is net (minus commissions and fees) unless `settings.pnlIsNet`.
- Deployment: GitHub Pages via `.github/workflows/deploy.yml` on push to `main`; `vite.config.ts`
  uses `base: "./"` and the app uses a hash router so it works from any sub-path.
- Days are keyed `YYYY-MM-DD`. `tradeDay()` uses the export's own `tradeDay` when present
  (Topstep's `TradeDay` column), else exit time in local time after the session rollover
  (`settings.sessionStartHour`, default 18). Never use `dayKey(t.exitTime)` for grouping.
- Timestamps with an explicit UTC offset are parsed as exact instants; display is browser-local.
- Stats functions take the whole `Settings` object, not individual flags.
- Charts: no animation, 2px lines, max 24px bars with rounded data-ends, hairline grid.
- Text never wears the series color except the profit/loss sign tint via `PnlText`.

## Design
- Project skill `.claude/skills/frontend-design` (Anthropic, Apache-2.0) loads for UI work. Its own rule
  applies: the brief wins. The brief here is "mega simple, like the Topstep stats dashboard, not
  cluttered", with the fluid-art glass look added on request: dashboard, calendar and day pages stay Topstep-like; spend any boldness on the landing
  and sign-in screens only.

## Commands
```
npm run dev · npm run build · npm test · npm run typecheck
```
