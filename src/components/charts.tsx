import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { BucketStat, CumPoint, HourStat, IntradayPoint } from "../lib/stats";
import { fmtMoney, fmtPct, fmtTime } from "../lib/format";
import { shortDate } from "../lib/dates";

const PROFIT = "#34c474";
const LOSS = "#df4f4a";
const NEUTRAL = "#8b93a2";
const GRID = "#262b35";
const TICK = { fill: "#aab1bf", fontSize: 12 };

function TooltipBox({ rows }: { rows: { label: string; value: string; tone?: number }[] }) {
  return (
    <div className="rounded-md border border-line bg-surface-2 px-3 py-2 text-xs shadow-lg">
      {rows.map((r) => (
        <div key={r.label} className="flex justify-between gap-4">
          <span className="text-ink-3">{r.label}</span>
          <span className={`num ${r.tone === undefined ? "" : r.tone > 0 ? "profit" : r.tone < 0 ? "loss" : ""}`}>
            {r.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function dollarTick(v: number) {
  return Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k` : String(v);
}

export function CumulativePnlChart({ data }: { data: CumPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="cumFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={PROFIT} stopOpacity={0.35} />
            <stop offset="100%" stopColor={PROFIT} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="date" tickFormatter={shortDate} tick={TICK} axisLine={{ stroke: GRID }} tickLine={false} />
        <YAxis tickFormatter={dollarTick} tick={TICK} axisLine={false} tickLine={false} width={48} />
        <ReferenceLine y={0} stroke={NEUTRAL} strokeOpacity={0.5} />
        <Tooltip
          cursor={{ stroke: NEUTRAL, strokeDasharray: "3 3" }}
          content={({ active, payload }) =>
            active && payload?.length ? (
              <TooltipBox
                rows={[
                  { label: "Date", value: payload[0].payload.date },
                  { label: "Day", value: fmtMoney(payload[0].payload.daily), tone: payload[0].payload.daily },
                  { label: "Cumulative", value: fmtMoney(payload[0].payload.cumulative), tone: payload[0].payload.cumulative },
                ]}
              />
            ) : null
          }
        />
        <Area
          isAnimationActive={false}
          type="monotone"
          dataKey="cumulative"
          stroke={PROFIT}
          strokeWidth={2}
          fill="url(#cumFill)"
          dot={false}
          activeDot={{ r: 4, stroke: "#15181e", strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function DailyPnlChart({ data }: { data: CumPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: 0 }} barCategoryGap="35%">
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="date" tickFormatter={shortDate} tick={TICK} axisLine={{ stroke: GRID }} tickLine={false} />
        <YAxis tickFormatter={dollarTick} tick={TICK} axisLine={false} tickLine={false} width={48} />
        <ReferenceLine y={0} stroke={NEUTRAL} strokeOpacity={0.6} />
        <Tooltip
          cursor={{ fill: "#ffffff", fillOpacity: 0.04 }}
          content={({ active, payload }) =>
            active && payload?.length ? (
              <TooltipBox
                rows={[
                  { label: "Date", value: payload[0].payload.date },
                  { label: "Net P&L", value: fmtMoney(payload[0].payload.daily), tone: payload[0].payload.daily },
                ]}
              />
            ) : null
          }
        />
        <Bar dataKey="daily" maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false}>
          {data.map((d) => (
            <Cell key={d.date} fill={d.daily >= 0 ? PROFIT : LOSS} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function HBars({
  data,
  valueKey,
  color,
  format,
  domain,
}: {
  data: (BucketStat | HourStat)[];
  valueKey: "count" | "winRate" | "pnl";
  color: (d: BucketStat | HourStat) => string;
  format: (v: number) => string;
  domain?: [number, number];
}) {
  const rows = data.map((d) => ({ ...d, v: Number.isFinite(d[valueKey]) ? d[valueKey] : 0 }));
  return (
    <ResponsiveContainer width="100%" height={Math.max(200, rows.length * 36 + 30)}>
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 56, bottom: 0, left: 8 }} barCategoryGap="30%">
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis
          type="number"
          domain={domain ?? [0, "auto"]}
          tick={TICK}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => (valueKey === "winRate" ? `${Math.round(v * 100)}%` : valueKey === "pnl" ? dollarTick(v) : String(v))}
        />
        <YAxis type="category" dataKey="label" tick={TICK} axisLine={false} tickLine={false} width={110} />
        {valueKey === "pnl" && <ReferenceLine x={0} stroke={NEUTRAL} strokeOpacity={0.6} />}
        <Tooltip
          cursor={{ fill: "#ffffff", fillOpacity: 0.04 }}
          content={({ active, payload }) =>
            active && payload?.length ? (
              <TooltipBox
                rows={[
                  { label: "Trades", value: String(payload[0].payload.count) },
                  { label: "Win rate", value: fmtPct(payload[0].payload.winRate) },
                  { label: "Net P&L", value: fmtMoney(payload[0].payload.pnl), tone: payload[0].payload.pnl },
                ]}
              />
            ) : null
          }
        />
        <Bar
          isAnimationActive={false}
          dataKey="v"
          maxBarSize={22}
          radius={[0, 4, 4, 0]}
          label={{
            position: "right",
            fill: "#f3f4f6",
            fontSize: 12,
            formatter: (v: number, _n?: unknown, idx?: number) =>
              rows[idx ?? 0]?.count ? format(v) : "",
          }}
        >
          {rows.map((d) => (
            <Cell key={d.label} fill={color(d)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DurationCountChart({ data }: { data: BucketStat[] }) {
  return <HBars data={data} valueKey="count" color={() => NEUTRAL} format={(v) => String(v)} />;
}

export function DurationWinRateChart({ data }: { data: BucketStat[] }) {
  return (
    <HBars
      data={data}
      valueKey="winRate"
      domain={[0, 1]}
      color={(d) => (d.winRate >= 0.5 ? PROFIT : LOSS)}
      format={(v) => fmtPct(v)}
    />
  );
}

export function HourPnlChart({ data }: { data: HourStat[] }) {
  return <HBars data={data} valueKey="pnl" color={(d) => (d.pnl >= 0 ? PROFIT : LOSS)} format={(v) => fmtMoney(v)} />;
}

export function IntradayChart({ data }: { data: IntradayPoint[] }) {
  const rows = data.map((p) => ({ ...p, up: Math.max(0, p.pnl), down: Math.min(0, p.pnl) }));
  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={rows} margin={{ top: 10, right: 12, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="upFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={PROFIT} stopOpacity={0.4} />
            <stop offset="100%" stopColor={PROFIT} stopOpacity={0.03} />
          </linearGradient>
          <linearGradient id="downFill" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor={LOSS} stopOpacity={0.4} />
            <stop offset="100%" stopColor={LOSS} stopOpacity={0.03} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis
          dataKey="time"
          type="number"
          domain={["dataMin", "dataMax"]}
          tickFormatter={(v) => fmtTime(v)}
          tick={TICK}
          axisLine={{ stroke: GRID }}
          tickLine={false}
          minTickGap={60}
        />
        <YAxis tickFormatter={dollarTick} tick={TICK} axisLine={false} tickLine={false} width={48} />
        <ReferenceLine y={0} stroke={NEUTRAL} strokeOpacity={0.6} strokeDasharray="4 4" />
        <Tooltip
          cursor={{ stroke: NEUTRAL, strokeDasharray: "3 3" }}
          content={({ active, payload }) =>
            active && payload?.length ? (
              <TooltipBox
                rows={[
                  { label: "Time", value: fmtTime(payload[0].payload.time) },
                  { label: "Running P&L", value: fmtMoney(payload[0].payload.pnl), tone: payload[0].payload.pnl },
                ]}
              />
            ) : null
          }
        />
        <Area type="monotone" dataKey="up" stroke="none" fill="url(#upFill)" isAnimationActive={false} activeDot={false} />
        <Area type="monotone" dataKey="down" stroke="none" fill="url(#downFill)" isAnimationActive={false} activeDot={false} />
        <Line
          type="monotone"
          dataKey="pnl"
          stroke={PROFIT}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, stroke: "#15181e", strokeWidth: 2 }}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function BalanceChart({ data }: { data: { date: string; balance: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="date" tickFormatter={shortDate} tick={TICK} axisLine={{ stroke: GRID }} tickLine={false} />
        <YAxis tickFormatter={dollarTick} tick={TICK} axisLine={false} tickLine={false} width={52} domain={["auto", "auto"]} />
        <Tooltip
          cursor={{ stroke: NEUTRAL, strokeDasharray: "3 3" }}
          content={({ active, payload }) =>
            active && payload?.length ? (
              <TooltipBox
                rows={[
                  { label: "Date", value: payload[0].payload.date },
                  { label: "Balance", value: fmtMoney(payload[0].payload.balance) },
                ]}
              />
            ) : null
          }
        />
        <Line
          isAnimationActive={false}
          type="monotone"
          dataKey="balance"
          stroke="#c9cfda"
          strokeWidth={2}
          dot={{ r: 3, fill: "#c9cfda", stroke: "#15181e", strokeWidth: 2 }}
          activeDot={{ r: 5, stroke: "#15181e", strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
