/** Small SVG figures used inside stat tiles: half-gauge, donut, split bar. */

const PROFIT = "var(--color-profit)";
const LOSS = "var(--color-loss)";
const SURFACE = "var(--color-surface)";

/** Half ring: share of `a` (profit colour) vs `b` (loss colour). */
export function HalfGauge({ a, b, size = 110 }: { a: number; b: number; size?: number }) {
  const total = a + b;
  const r = size / 2 - 8;
  const cx = size / 2;
  const cy = size / 2;
  const frac = total ? a / total : 0;
  const arc = (from: number, to: number) => {
    // angles in [0,1] over the top half, left (180°) to right (0°)
    const toXY = (f: number) => {
      const ang = Math.PI * (1 - f);
      return [cx + r * Math.cos(ang), cy - r * Math.sin(ang)] as const;
    };
    const [x1, y1] = toXY(from);
    const [x2, y2] = toXY(to);
    // The gauge spans half a circle, so no segment ever exceeds 180°.
    return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`;
  };
  const split = 1 - frac; // losses fill the left arm, wins the right
  const h = size / 2 + 18;
  return (
    <svg width={size} height={h} viewBox={`0 0 ${size} ${h}`} aria-hidden>
      {split > 0 && <path d={arc(0, split)} stroke={LOSS} strokeWidth={10} fill="none" />}
      {frac > 0 && <path d={arc(split, 1)} stroke={PROFIT} strokeWidth={10} fill="none" />}
      {/* 2px surface gap at the join */}
      {frac > 0 && frac < 1 && (
        <path d={arc(Math.max(0, split - 0.004), Math.min(1, split + 0.004))} stroke={SURFACE} strokeWidth={12} fill="none" />
      )}
      <text x={cx - r} y={cy + 14} fontSize={11} fill="var(--color-ink-2)" textAnchor="middle" className="num">
        {b}
      </text>
      <text x={cx + r} y={cy + 14} fontSize={11} fill="var(--color-ink-2)" textAnchor="middle" className="num">
        {a}
      </text>
    </svg>
  );
}

/** Full ring with two shares. */
export function Donut({ a, b, size = 84, thick = 10 }: { a: number; b: number; size?: number; thick?: number }) {
  const total = a + b;
  const r = size / 2 - thick / 2 - 1;
  const c = 2 * Math.PI * r;
  const fa = total ? a / total : 0;
  const gap = 2; // px of surface between segments
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} stroke={LOSS} strokeWidth={thick} fill="none" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={PROFIT}
        strokeWidth={thick}
        fill="none"
        strokeDasharray={`${Math.max(0, fa * c - gap)} ${c}`}
        strokeDashoffset={-gap / 2}
      />
      {fa > 0 && fa < 1 && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={SURFACE}
          strokeWidth={thick + 2}
          fill="none"
          strokeDasharray={`${gap} ${c}`}
          strokeDashoffset={-(fa * c - gap / 2)}
        />
      )}
    </svg>
  );
}

/** Horizontal split bar, profit share on the left. */
export function SplitBar({ a, b }: { a: number; b: number }) {
  const total = a + b;
  const fa = total ? (a / total) * 100 : 50;
  return (
    <div className="flex h-2.5 w-full overflow-hidden rounded-full" aria-hidden>
      <div style={{ width: `${fa}%`, background: PROFIT }} />
      <div style={{ width: 2, background: SURFACE }} />
      <div style={{ flex: 1, background: LOSS }} />
    </div>
  );
}
