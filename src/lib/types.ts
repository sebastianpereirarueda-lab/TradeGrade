export type Direction = "Long" | "Short";

/** One round-trip trade, as exported by Topstep / Tradovate style reports. */
export interface Trade {
  id: string;
  contract: string; // e.g. "/MNQ"
  size: number; // contracts (lots)
  entryTime: number; // epoch ms
  exitTime: number; // epoch ms
  entryPrice: number;
  exitPrice: number;
  pnl: number; // gross P&L in account currency
  commissions: number; // positive magnitude
  fees: number; // positive magnitude
  direction: Direction;
  /** Trading day (YYYY-MM-DD) as assigned by the broker's export, when it provides one. */
  tradeDay?: string;
}

export interface Rule {
  id: string;
  text: string;
  enabled: boolean;
}

/** Everything the trader records about one calendar day. Keyed by YYYY-MM-DD. */
export interface DayJournal {
  date: string;
  notes: string;
  /** rule id -> followed? Missing means "not reviewed". */
  rules: Record<string, boolean>;
  /** 1-5 self-ratings. */
  psych: {
    discipline?: number;
    patience?: number;
    emotion?: number;
  };
  updatedAt: number;
}

export interface Settings {
  startingBalance: number;
  /** Treat commissions and fees as already included in `pnl`. */
  pnlIsNet: boolean;
  /** Hour (0-23, local) at which a new trading day starts. 18 = CME evening open. */
  sessionStartHour: number;
}

export interface AppState {
  trades: Trade[];
  journals: Record<string, DayJournal>;
  rules: Rule[];
  settings: Settings;
  /** Free-form note per trade id. */
  tradeNotes: Record<string, string>;
  /** Last local change, epoch ms. Used to reconcile with the cloud copy. */
  updatedAt?: number;
}

export interface DateRange {
  from: string | null; // YYYY-MM-DD inclusive
  to: string | null; // YYYY-MM-DD inclusive
}
