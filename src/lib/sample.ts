import type { Trade } from "./types";

/** Deterministic pseudo-random generator so the sample never changes between loads. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CONTRACTS = [
  { name: "/MNQ", pointValue: 2, tick: 0.25, base: 30700, vol: 30 },
  { name: "/ES", pointValue: 50, tick: 0.25, base: 7730, vol: 4 },
];

/** ~85 trades over the last ~3 weeks of weekdays, evening session. */
export function sampleTrades(now = new Date()): Trade[] {
  const rand = mulberry32(42);
  const trades: Trade[] = [];
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let id = 1;
  for (let back = 20; back >= 1; back--) {
    const d = new Date(day);
    d.setDate(d.getDate() - back);
    const wd = d.getDay();
    if (wd === 0 || wd === 6) continue;
    if (back > 3 && rand() < 0.2) continue; // occasional skipped days, but always the recent ones
    const n = 3 + Math.floor(rand() * 7);
    let t = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 18, 0, 0).getTime();
    for (let i = 0; i < n; i++) {
      const c = CONTRACTS[rand() < 0.75 ? 0 : 1];
      const size = 1 + Math.floor(rand() * 5);
      const durSec = Math.round(Math.exp(2.5 + rand() * 5)); // 12s .. ~30min
      const entryTime = t + Math.round(rand() * 8 * 60_000);
      const exitTime = entryTime + durSec * 1000;
      const dirLong = rand() < 0.57;
      const edge = durSec > 600 ? 0.62 : 0.42; // longer holds win more often, like the screenshots
      const win = rand() < edge;
      const movePts = (0.3 + rand() * 1.4) * c.vol * (win ? 1 : 0.8);
      const pts = Math.round(movePts / c.tick) * c.tick * (win ? 1 : -1);
      const entryPrice = c.base + Math.round(((rand() - 0.5) * c.vol * 6) / c.tick) * c.tick;
      const exitPrice = entryPrice + (dirLong ? pts : -pts);
      const pnl = Math.round(pts * c.pointValue * size * 100) / 100;
      trades.push({
        id: String(id++),
        contract: c.name,
        size,
        entryTime,
        exitTime,
        entryPrice,
        exitPrice,
        pnl,
        commissions: Math.round(size * 0.35 * 2 * 100) / 100,
        fees: Math.round(size * 0.37 * 2 * 100) / 100,
        direction: dirLong ? "Long" : "Short",
      });
      t = exitTime + Math.round(rand() * 10 * 60_000);
    }
  }
  return trades;
}
