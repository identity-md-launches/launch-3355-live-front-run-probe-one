export type FieldKey = "amountIn" | "slippage" | "reserveIn" | "reserveOut" | "fee" | "gasCost";
export type Values = Record<FieldKey, string>;

export interface FieldSpec {
  key: FieldKey;
  /** Short key used in the page address. */
  param: string;
  label: string;
  unit: string;
  /** Unit spoken to assistive technology when the label does not already name it. */
  spokenUnit?: string;
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
  { key: "amountIn", param: "a", label: "You sell", unit: "A", spokenUnit: "token A", min: 0, exclusiveMin: true, error: "Enter an amount above 0" },
  { key: "slippage", param: "s", label: "Slippage tolerance", unit: "%", spokenUnit: "percent", min: 0, max: 50, error: "Enter a slippage from 0 to 50" },
  { key: "reserveIn", param: "x", label: "Pool reserve of A", unit: "A", min: 0, exclusiveMin: true, error: "Enter a reserve above 0" },
  { key: "reserveOut", param: "y", label: "Pool reserve of B", unit: "B", min: 0, exclusiveMin: true, error: "Enter a reserve above 0" },
  { key: "fee", param: "f", label: "Pool fee", unit: "%", spokenUnit: "percent", min: 0, max: 10, error: "Enter a fee from 0 to 10" },
  { key: "gasCost", param: "g", label: "Attacker gas cost", unit: "A", spokenUnit: "token A", hint: "Both transactions together", min: 0, error: "Enter a gas cost of 0 or more" },
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

export type ParsedNumber = { ok: true; value: number } | { ok: false; reason: "empty" | "malformed" | "ambiguous"; hint?: string };

const GROUP_SPACE = /[\s  _]/;

/**
 * Reads a number typed in either common convention: "1,234.5", "1.234,5", "1 234,5", "0,5", "0.5",
 * "1e32". A single separator followed by exactly three digits ("1,234" or "1.234") is decimal for a dot
 * (the JavaScript reading) and ambiguous for a comma, which is rejected rather than guessed.
 */
export function parseNumber(raw: string): ParsedNumber {
  const text = raw.trim();
  if (text === "") return { ok: false, reason: "empty" };
  const match = /^([+-]?)([0-9.,\s  _]*)([eE][+-]?[0-9]+)?$/.exec(text);
  if (!match) return { ok: false, reason: "malformed" };
  const [, sign, mantissa, exponent = ""] = match;
  const dots = mantissa.split(".").length - 1;
  const commas = mantissa.split(",").length - 1;

  let decimal: "." | "," | null = null;
  if (dots && commas) {
    decimal = mantissa.lastIndexOf(".") > mantissa.lastIndexOf(",") ? "." : ",";
    if ((decimal === "." ? dots : commas) > 1) return { ok: false, reason: "malformed" };
  } else if (commas === 1) {
    const [before, after] = mantissa.split(",");
    const intDigits = before.replace(new RegExp(GROUP_SPACE, "g"), "");
    const spaceGrouped = GROUP_SPACE.test(before);
    if (!spaceGrouped && after.length === 3 && /^[0-9]+$/.test(after) && !/^0*$/.test(intDigits)) {
      return { ok: false, reason: "ambiguous", hint: `${intDigits}${after} or ${intDigits}.${after}` };
    }
    decimal = ",";
  } else if (dots === 1) {
    decimal = ".";
  }

  const [intPart, fracPart = ""] = decimal ? mantissa.split(decimal) : [mantissa];
  if (!/^[0-9]*$/.test(fracPart)) return { ok: false, reason: "malformed" };
  const groups = intPart.split(/[.,\s  _]/);
  if (groups.length > 1) {
    if (!/^[0-9]{1,3}$/.test(groups[0]) || groups.slice(1).some((g) => !/^[0-9]{3}$/.test(g))) {
      return { ok: false, reason: "malformed" };
    }
  } else if (!/^[0-9]*$/.test(intPart)) {
    return { ok: false, reason: "malformed" };
  }
  const digits = groups.join("");
  if (digits === "" && fracPart === "") return { ok: false, reason: "malformed" };
  const value = Number(`${sign}${digits || "0"}.${fracPart || "0"}${exponent}`);
  return Number.isFinite(value) ? { ok: true, value } : { ok: false, reason: "malformed" };
}

/** Parses one field; returns the number or the error text to show beside it. */
export function parseField(field: FieldSpec, raw: string): number | string {
  const parsed = parseNumber(raw);
  if (!parsed.ok) return parsed.reason === "ambiguous" ? `Unclear: write ${parsed.hint}` : field.error;
  const value = parsed.value;
  if (field.exclusiveMin ? value <= field.min : value < field.min) return field.error;
  if (field.max !== undefined && value > field.max) return field.error;
  return value;
}

/**
 * The scenario as a query string, written from the parsed numbers so the address carries exactly the
 * values the result was computed from. Fragments stay free for in-page links (#method, #top).
 */
export function writeQuery(numbers: Record<FieldKey, number>): string {
  const params = new URLSearchParams();
  for (const field of FIELDS) params.set(field.param, String(numbers[field.key]));
  return `?${params.toString()}`;
}

function readParams(params: URLSearchParams): Values | null {
  const values = {} as Values;
  for (const field of FIELDS) {
    const raw = params.get(field.param);
    if (raw === null) return null;
    values[field.key] = raw;
  }
  return values;
}

/** Scenario from a query string (?a=…&s=…); null when any field is missing. */
export function readQuery(search: string): Values | null {
  return readParams(new URLSearchParams(search.replace(/^\?/, "")));
}

/** Scenario from an older link that kept it in the fragment (#a=…&s=…); null otherwise. */
export function readLegacyHash(hash: string): Values | null {
  return readParams(new URLSearchParams(hash.replace(/^#/, "")));
}
