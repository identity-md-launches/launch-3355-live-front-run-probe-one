export type FieldKey = "amountIn" | "slippage" | "reserveIn" | "reserveOut" | "fee" | "gasCost";
export type Values = Record<FieldKey, string>;

export interface FieldSpec {
  key: FieldKey;
  /** Short key used in the page address. */
  param: string;
  label: string;
  unit: string;
  hint?: string;
  min: number;
  /** When true the value must be strictly above `min`. */
  exclusiveMin?: boolean;
  max?: number;
  error: string;
}

// Order is the reading order in the form: the two values a trader sets first,
// then the pool, then the attacker's cost.
export const FIELDS: FieldSpec[] = [
  { key: "amountIn", param: "a", label: "You sell", unit: "A", min: 0, exclusiveMin: true, error: "Enter an amount above 0" },
  { key: "slippage", param: "s", label: "Slippage tolerance", unit: "%", min: 0, max: 50, error: "Enter a slippage from 0 to 50" },
  { key: "reserveIn", param: "x", label: "Pool reserve of A", unit: "A", min: 0, exclusiveMin: true, error: "Enter a reserve above 0" },
  { key: "reserveOut", param: "y", label: "Pool reserve of B", unit: "B", min: 0, exclusiveMin: true, error: "Enter a reserve above 0" },
  { key: "fee", param: "f", label: "Pool fee", unit: "%", min: 0, max: 10, error: "Enter a fee from 0 to 10" },
  { key: "gasCost", param: "g", label: "Attacker gas cost", unit: "A", hint: "Both transactions together", min: 0, error: "Enter a gas cost of 0 or more" },
];

export interface Example {
  name: string;
  values: Values;
}

// Illustrative pools, not live reserves. Prices are 3,000 B per A.
export const EXAMPLES: Example[] = [
  { name: "Deep pool", values: { amountIn: "10", slippage: "0.5", reserveIn: "20000", reserveOut: "60000000", fee: "0.3", gasCost: "0.005" } },
  { name: "Mid pool", values: { amountIn: "2", slippage: "1", reserveIn: "400", reserveOut: "1200000", fee: "0.3", gasCost: "0.003" } },
  { name: "Thin pool", values: { amountIn: "5", slippage: "3", reserveIn: "50", reserveOut: "150000", fee: "0.3", gasCost: "0.005" } },
];

/** Parses one field; returns the number or the error text to show beside it. */
export function parseField(field: FieldSpec, raw: string): number | string {
  const cleaned = raw.replace(/[\s,_]/g, "");
  if (cleaned === "") return field.error;
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return field.error;
  if (field.exclusiveMin ? value <= field.min : value < field.min) return field.error;
  if (field.max !== undefined && value > field.max) return field.error;
  return value;
}

export function writeHash(values: Values): string {
  const params = new URLSearchParams();
  for (const field of FIELDS) params.set(field.param, values[field.key].replace(/[\s,_]/g, ""));
  return `#${params.toString()}`;
}

/** Reads values from a page address hash; null when any field is missing. */
export function readHash(hash: string): Values | null {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const values = {} as Values;
  for (const field of FIELDS) {
    const raw = params.get(field.param);
    if (raw === null) return null;
    values[field.key] = raw;
  }
  return values;
}
