# TradeGrade

**Your trading, graded.** A simple, Topstep-style stats dashboard for futures
traders: drop in the trade export from your prop firm, get the numbers that
matter, journal every day, and grade yourself against your own rules.

Everything runs in the browser. No account, no server: data stays on the
user's machine (`localStorage`) with JSON backup and restore.

## Import anything

Drop a **CSV, Excel (.xlsx) or PDF** export onto the dashboard. Columns are
matched by name (case and punctuation ignored), so the Topstep trade list,
Tradovate performance exports and hand-made sheets all work. Required: entry
time, exit time, P&L. Recognised: `ID, Contract, Size, Entry Time, Exit Time,
Entry Price, Exit Price, P&L, Commissions, Fees, Direction`.

- Times may be ISO, US `MM/DD/YYYY HH:MM:SS`, or Topstep's
  `September 30 2026 @ 7:59:06 pm`, read in the browser's local time zone.
- Money may be `$425.00`, `$-1.00`, `(763.90)` or `7,743.50`.
- PDFs are rebuilt from the text positions on the page: the header line fixes
  the columns, rows follow, repeated headers on later pages are skipped.
- Re-importing a file merges by trade ID, so you can export weekly and never
  get duplicates.

## Pages

- **Dashboard** – date range presets, total P&L, trade win %, avg win / avg
  loss, day win %, profit factor, best day % of profit, account balance,
  cumulative and daily P&L, duration and win rate by duration, weekday stats,
  direction split, best / worst trade.
- **Calendar** – month grid with net P&L and trade count per day and weekly
  totals. Click a day to open it.
- **Day** – intraday P&L curve, day journal, rules checklist (followed /
  broken), psychology ratings, computed A–F grade, trades with a note per
  trade.
- **Rules** – edit the checklist; P&L by day grade and per rule; P&L by entry
  hour and by weekday; where losing trades land in points per contract
  (median / 75th / 90th percentile) as a stop-loss sanity check.
- **Import** – file import with a preview, starting balance, trading-day
  start hour (18:00 by default, so a 7 PM trade on the 30th counts for the
  1st exactly like Topstep), sample data, backup / restore.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

```bash
npm run build      # static site in dist/
npm run preview
npm test           # vitest: stats engine, CSV/Excel/PDF importers
npm run typecheck
```

## Deploy

The site is static, so it can be hosted anywhere. The repository ships with
GitHub Pages deployment:

1. Push to `main`.
2. `.github/workflows/deploy.yml` tests, builds, enables GitHub Pages on the
   first run and publishes `dist/`. The URL appears in the workflow summary
   (`https://<owner>.github.io/<repo>/`).

Netlify, Vercel or Cloudflare Pages work the same way: build command
`npm run build`, output directory `dist`.

## Roadmap

- [x] Main page with the key metrics
- [x] Calendar with daily P&L that opens the day's journal
- [x] Journal per day, notes per trade
- [x] Rules checklist and psychological grades
- [x] CSV, Excel and PDF import; session rollover like Topstep
- [x] Deploy as a website
- [ ] Optional accounts and cloud sync so one user can use several devices
- [ ] Rich text journal (plain text for now)
- [ ] Direct prop-firm API sync instead of file export
