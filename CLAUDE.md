# Trading Dashboard

Topstep-style personal trading stats dashboard. Vite + React 18 + TypeScript,
Tailwind v4, Recharts, react-router (hash router). No backend; state is in
`localStorage` via `src/lib/store.ts`.

## Layout
- `src/lib/types.ts` – `Trade`, `DayJournal`, `Rule`, `Settings`, `AppState`.
- `src/lib/stats.ts` – pure stats engine (summary, buckets, grades, percentiles). Tested.
- `src/lib/csv.ts` – CSV column matching and parsing. Tested.
- `src/lib/store.ts` – persisted store, `useAppState()`, `actions`.
- `src/lib/sample.ts` – deterministic sample trades.
- `src/components/charts.tsx` – all Recharts charts. `gauges.tsx` – SVG gauges.
- `src/pages/*` – Dashboard, Calendar, Day, Rules, Import.

## Conventions
- Keep it simple and uncluttered; match the Topstep look (dark surfaces, green
  profit `#34c474`, red loss `#df4f4a`, neutral gray). Colors are tokens in `src/index.css`.
- All metric math lives in `src/lib/stats.ts` as pure functions with tests; pages only
  compose them. P&L is net (minus commissions and fees) unless `settings.pnlIsNet`.
- Days are keyed `YYYY-MM-DD` in local time, by exit time.
- Charts: no animation, 2px lines, max 24px bars with rounded data-ends, hairline grid.
- Text never wears the series color except the profit/loss sign tint via `PnlText`.

## Commands
```
npm run dev · npm run build · npm test · npm run typecheck
```
