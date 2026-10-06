import { rootSymbol } from "./dates";

/**
 * Dollar value of a one-point move for one contract, by root symbol.
 * CME Group / ICE contract specs for the products prop firms allow.
 */
export const POINT_VALUE: Record<string, number> = {
  // Equity index
  ES: 50, MES: 5, NQ: 20, MNQ: 2, YM: 5, MYM: 0.5, RTY: 50, M2K: 5, EMD: 100, NKD: 5,
  // Energy
  CL: 1000, MCL: 100, QM: 500, NG: 10000, QG: 2500, MNG: 1000, RB: 42000, HO: 42000,
  // Metals
  GC: 100, MGC: 10, SI: 5000, SIL: 1000, HG: 25000, MHG: 2500, PL: 50, PA: 100,
  // Interest rates
  ZB: 1000, UB: 1000, ZN: 1000, TN: 1000, ZF: 1000, ZT: 2000,
  // FX
  "6A": 100000, "6B": 62500, "6C": 100000, "6E": 125000, "6J": 12500000, "6S": 125000, "6N": 100000, "6M": 500000,
  M6A: 10000, M6B: 6250, M6E: 12500,
  E7: 62500, J7: 6250000,
  // Agriculture (prices quoted in cents per bushel: 50 bushels-per-cent equivalent)
  ZC: 50, ZS: 50, ZW: 50, ZL: 600, ZM: 100, HE: 400, LE: 400, GF: 500,
  // Crypto
  BTC: 5, MBT: 0.1, ETH: 50, MET: 0.1,
};

export function pointValue(contract: string): number | undefined {
  return POINT_VALUE[rootSymbol(contract)];
}
