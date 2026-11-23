const big = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const mid = new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 });
const small = new Intl.NumberFormat("en-US", { maximumSignificantDigits: 4 });
const percent = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 2 });

/** Token amounts: grouped, with precision that suits the magnitude. */
export function formatAmount(value: number): string {
  if (!Number.isFinite(value)) return "Not available";
  const abs = Math.abs(value);
  if (abs === 0) return "0";
  if (abs >= 1000) return big.format(value);
  if (abs >= 1) return mid.format(value);
  return small.format(value);
}

/** Fractions as percentages, e.g. 0.0037 becomes "0.37%". */
export function formatPercent(fraction: number): string {
  return percent.format(fraction);
}
