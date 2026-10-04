# TradeGrade

Topstep-style trading stats dashboard with a journal and rule grading. Vite + React 18 + TypeScript,
Tailwind v4, Recharts, react-router (hash router). No backend; state is in
`localStorage` via `src/lib/store.ts`.

## Layout
- `src/lib/types.ts` – `Trade`, `DayJournal`, `Rule`, `Settings`, `AppState`.
- `src/lib/stats.ts` – pure stats engine (summary, buckets, grades, percentiles). Tested.
- `src/lib/importers/` – `rows.ts` shared header detection and row mapping; `csv.ts`,
  `xlsx.ts` (SheetJS), `pdf.ts` (pdf.js text positions -> grid); `index.ts` dispatches by
  file type and lazy-loads the heavy parsers. Tested.
- `src/lib/store.ts` – persisted store, `useAppState()`, `actions`.
- `src/lib/media.ts` – journal attachments as Blobs in IndexedDB (`tradegrade-media`), hooks
  `useAttachments(date)` / `useAttachmentDates()`. Tested with fake-indexeddb.
- `src/components/Attachments.tsx` – drop / paste / pick media, voice-note recorder, lightbox.
- `src/lib/sample.ts` – deterministic sample trades.
- `src/components/charts.tsx` – all Recharts charts. `gauges.tsx` – SVG gauges.
- `src/pages/*` – Dashboard, Calendar, Day, Rules, Import.

## Conventions
- Keep it simple and uncluttered; match the Topstep look (dark surfaces, green
  profit `#34c474`, red loss `#df4f4a`, neutral gray). Colors are tokens in `src/index.css`.
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

## Commands
```
npm run dev · npm run build · npm test · npm run typecheck
```
