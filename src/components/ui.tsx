import type { ReactNode } from "react";

export function Card({
  title,
  children,
  className = "",
  right,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
  right?: ReactNode;
}) {
  return (
    <section className={`card ${className}`}>
      {(title || right) && (
        <div className="flex items-start justify-between gap-3">
          {title && <h3 className="card-title">{title}</h3>}
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export function PnlText({ value, children, className = "" }: { value: number; children: ReactNode; className?: string }) {
  const tone = value > 0 ? "profit" : value < 0 ? "loss" : "";
  return <span className={`${tone} ${className}`}>{children}</span>;
}

/** Label + big value, optionally with a side slot (gauge, details). */
export function StatTile({
  title,
  value,
  tone,
  side,
  sub,
}: {
  title: string;
  value: ReactNode;
  tone?: number;
  side?: ReactNode;
  sub?: ReactNode;
}) {
  const cls = tone === undefined ? "" : tone > 0 ? "profit" : tone < 0 ? "loss" : "";
  return (
    <Card title={title}>
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className={`tile-value ${cls}`}>{value}</div>
          {sub && <div className="mt-1 text-xs text-ink-3">{sub}</div>}
        </div>
        {side && <div className="shrink-0">{side}</div>}
      </div>
    </Card>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="py-10 text-center text-sm text-ink-3">{children}</div>;
}
