# Trading Dashboard

A simple, Topstep-style stats dashboard for my own futures trading: import the
trade list, see the numbers that matter, journal each day, and grade myself
against my rules.

Everything runs in the browser. There is no backend and no account: data lives
in `localStorage`, with JSON backup/restore from the Import page.

## Pages

- **Dashboard** – date range (custom / today / last week / last month / all),
  total P&L, trade win %, avg win / avg loss, day win %, profit factor, best
  day % of profit, account balance, cumulative and daily P&L, trade duration
  and win rate by duration, weekday stats, durations, direction split,
  best / worst trade.
- **Calendar** – month grid with net P&L and trade count per day plus weekly
  totals. Click a day to open it.
- **Day** – intraday P&L curve, journal, rules checklist (followed / broken),
  psychology ratings (discipline, patience, emotional control) and the day's
  trades. Grades A–F are computed from the checklist and ratings.
- **Rules** – edit the checklist, see P&L by day grade and per rule (followed
  vs broken), P&L by entry hour and by weekday, and where losing trades land
  in points per contract (median / 75th / 90th percentile) as a stop-loss
  sanity check.
- **Import** – CSV import (Topstep / Tradovate style trade list), settings
  (starting balance, whether P&L is already net of fees), sample data,
  backup / restore, clear.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

```bash
npm run build      # static site in dist/
npm run preview
npm test           # vitest: stats engine + CSV parser
npm run typecheck
```

## CSV format

Columns are matched by name (case and punctuation ignored). Required: entry
time, exit time, P&L. Recognised: `ID, Contract, Size, Entry Time, Exit Time,
Entry Price, Exit Price, P&L, Commissions, Fees, Direction`. Times may be ISO or
US `MM/DD/YYYY HH:MM:SS` (with or without AM/PM) and are read in the browser's
local time zone. Re-importing a file merges by trade ID.

## Roadmap (from the planning board)

- [x] Main page with the key metrics
- [x] Calendar with daily P&L that opens the day's journal
- [x] Journal per day
- [x] Rules checklist and psychological grades
- [ ] Grader: per-trade "followed the plan" tagging
- [ ] Comments / annotations on individual trades
- [ ] Rich text journal (the editor is plain text for now)
- [ ] Optional sync (Topstep API or a small backend) instead of CSV import
