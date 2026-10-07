# TradeGrade

**Your trading, graded.** A simple, Topstep-style stats dashboard for futures
traders: drop in the trade export from your prop firm, get the numbers that
matter, journal every day, and grade yourself against your own rules.

Runs entirely in the browser. Without an account, data stays on the user's
machine (`localStorage` for trades and journals, IndexedDB for media) with
JSON backup and restore. With accounts enabled (see below), users sign in
and everything syncs to their account and across devices.

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
- **Orders exports** (one row per order, such as Topstep's orders export or
  Tradovate's Orders report) are paired into round trips: filled orders are
  matched first-in-first-out per contract, cancelled and rejected orders are
  ignored, and P&L uses the contract's dollar value per point
  (`src/lib/contracts.ts`). Orders exports carry no fees, so that P&L is
  gross; the trades export gives exact net P&L.

## Pages

- **Scorecards** (top of the dashboard) – a GPA from 0.0 to 4.0 combining
  the metrics you pick. Each metric earns 4.0 at its A target and 0.0 at its
  F target, linear in between, and the GPA is the weighted average. Add
  metrics from the dropdown (performance, risk, and discipline such as rules
  followed, checklist completed, journaled, or both), set weights and
  targets, and keep several scorecards. Discipline metrics count only days
  you traded. A weekly trend shows the GPA week by week.
- **Dashboard** – date range presets, total P&L, trade win %, avg win / avg
  loss, day win %, profit factor, best day % of profit, account balance,
  cumulative and daily P&L, duration and win rate by duration, weekday stats,
  direction split, best / worst trade.
- **Calendar** – month grid with net P&L and trade count per day and weekly
  totals. Click a day to open it.
- **Day** – intraday P&L curve, day journal, rules checklist (followed /
  broken), psychology ratings, computed A–F grade, attachments (drop or
  paste screenshots, add videos or audio, record a voice note in the
  browser), trades with a note per trade.
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

1. In the repository, open **Settings → Pages** and set **Source** to
   **GitHub Actions** (one time; the workflow token cannot do this itself).
2. Push to `main`. `.github/workflows/deploy.yml` tests, builds and publishes
   `dist/`. The URL appears in the workflow summary
   (`https://<owner>.github.io/<repo>/`).

Netlify, Vercel or Cloudflare Pages work the same way: build command
`npm run build`, output directory `dist`.

## Accounts (sign-in and sync)

Sign-in uses [Supabase](https://supabase.com) (free tier is plenty): email +
password, magic link, Google. Each user's data is one JSON row and their
attachments live in a private storage bucket, both locked to the user by
row-level security. One-time setup, about ten minutes:

1. Create a project at https://supabase.com/dashboard (any region, any
   password; keep the database password somewhere safe).
2. Open **SQL Editor**, paste the contents of `supabase/schema.sql`, click
   **Run**.
3. **Authentication → URL Configuration**: set **Site URL** to the deployed
   app URL (for GitHub Pages `https://<owner>.github.io/TradeGrade/`) and add
   the same URL under **Redirect URLs**. Add `http://localhost:5173/` too if
   you develop locally.
4. Optional, for Google sign-in: **Authentication → Providers → Google**,
   enable it, and paste a Google OAuth client ID and secret (created in the
   Google Cloud console with the redirect URI Supabase shows there).
5. **Settings → API**: copy the **Project URL** and the **anon public** key.
6. Put the **Project URL** (`https://<ref>.supabase.co`, not the app's
   own address) and the key into `.github/workflows/deploy.yml`, in the
   `env` of the build step.
7. Push or re-run the **Deploy** workflow (Actions tab). The header now
   shows **Sign in**.

The anon key is designed to be public; access is enforced by the policies
in the schema. Locally, copy `.env.example` to `.env` with the same values.

How sync behaves: on first sign-in on a device that already has data, the
app asks whether to use the account's data or upload the device's. After
that every change is saved to the account within about a second, and a dot
in the header shows the status. Attachments upload on add and download on
demand on the day they belong to.

## Roadmap

- [x] Main page with the key metrics
- [x] Calendar with daily P&L that opens the day's journal
- [x] Journal per day, notes per trade
- [x] Screenshots, video and audio attachments, voice notes
- [x] Rules checklist and psychological grades
- [x] CSV, Excel and PDF import; session rollover like Topstep
- [x] Deploy as a website
- [x] Accounts and cloud sync (Supabase)
- [ ] Rich text journal (plain text for now)
- [ ] Direct prop-firm API sync instead of file export
