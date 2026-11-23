// Sandwich (front-run + back-run) exposure on a constant-product pool.
//
// Model: Uniswap v2 style pool holding `reserveIn` of token A and `reserveOut`
// of token B, with the whole input (fee included) added to reserves. One
// attacker sees the victim's pending swap of `amountIn` A for B, buys B first
// with `a` A, lets the victim swap, then sells the B it bought. The victim's
// slippage tolerance sets the lowest output it will accept; the attacker may
// push the price only until the victim would receive exactly that minimum.

export interface SwapInput {
  /** Victim's swap size, in token A. */
  amountIn: number;
  /** Pool reserve of token A (the token the victim sells). */
  reserveIn: number;
  /** Pool reserve of token B (the token the victim buys). */
  reserveOut: number;
  /** Pool fee as a fraction, e.g. 0.003 for 0.3%. */
  fee: number;
  /** Victim's slippage tolerance as a fraction, e.g. 0.005 for 0.5%. */
  slippage: number;
  /** Attacker's total gas cost for both transactions, in token A. */
  gasCost: number;
}

export interface SandwichResult {
  /** B the victim receives with no attacker. */
  expectedOut: number;
  /** Lowest B the victim accepts: expectedOut × (1 − slippage). */
  minOut: number;
  /** Victim's price impact without an attacker, as a fraction. */
  priceImpact: number;
  /** Most profitable front-run size, in A (0 when no attack pays). */
  frontRun: number;
  /** B the victim receives when sandwiched with `frontRun`. */
  victimOut: number;
  /** B the victim loses to the sandwich. */
  victimLoss: number;
  /** Attacker profit in A before gas. */
  grossProfit: number;
  /** Attacker profit in A after gas. */
  netProfit: number;
  /** True when a sandwich makes money after gas. */
  exposed: boolean;
}

/** Output of a constant-product swap with the fee taken from the input. */
export function amountOut(amount: number, reserveIn: number, reserveOut: number, fee: number): number {
  if (amount <= 0) return 0;
  const withFee = amount * (1 - fee);
  return (withFee * reserveOut) / (reserveIn + withFee);
}

interface Attack {
  victimOut: number;
  gross: number;
}

/** Plays one sandwich with front-run size `a` and reports both sides. */
function playAttack(input: SwapInput, a: number): Attack {
  const { amountIn, reserveIn: x, reserveOut: y, fee } = input;
  const bought = amountOut(a, x, y, fee);
  const x1 = x + a;
  const y1 = y - bought;
  const victimOut = amountOut(amountIn, x1, y1, fee);
  const x2 = x1 + amountIn;
  const y2 = y1 - victimOut;
  const soldBack = amountOut(bought, y2, x2, fee);
  return { victimOut, gross: soldBack - a };
}

/** Largest front-run that still leaves the victim at least `minOut`. */
function maxFrontRun(input: SwapInput, minOut: number): number {
  if (playAttack(input, 0).victimOut <= minOut) return 0;
  let lo = 0;
  let hi = Math.max(input.amountIn, input.reserveIn * 1e-6);
  for (let i = 0; i < 200 && playAttack(input, hi).victimOut >= minOut; i++) {
    lo = hi;
    hi *= 2;
  }
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (playAttack(input, mid).victimOut >= minOut) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** Front-run size in [0, limit] with the highest gross profit. */
function bestFrontRun(input: SwapInput, limit: number): { a: number; attack: Attack } {
  let best = { a: 0, attack: playAttack(input, 0) };
  if (limit <= 0) return best;
  const steps = 200;
  let bestIndex = 0;
  for (let i = 1; i <= steps; i++) {
    const a = (limit * i) / steps;
    const attack = playAttack(input, a);
    if (attack.gross > best.attack.gross) {
      best = { a, attack };
      bestIndex = i;
    }
  }
  // Golden-section refinement around the best sample.
  let lo = (limit * Math.max(0, bestIndex - 1)) / steps;
  let hi = (limit * Math.min(steps, bestIndex + 1)) / steps;
  const ratio = (Math.sqrt(5) - 1) / 2;
  for (let i = 0; i < 60; i++) {
    const m1 = hi - ratio * (hi - lo);
    const m2 = lo + ratio * (hi - lo);
    if (playAttack(input, m1).gross < playAttack(input, m2).gross) lo = m1;
    else hi = m2;
  }
  const a = (lo + hi) / 2;
  const attack = playAttack(input, a);
  if (attack.gross > best.attack.gross) best = { a, attack };
  return best;
}

export function probe(input: SwapInput): SandwichResult {
  const { amountIn, reserveIn, reserveOut, fee, slippage, gasCost } = input;
  const expectedOut = amountOut(amountIn, reserveIn, reserveOut, fee);
  const minOut = expectedOut * (1 - slippage);
  const spotOut = (amountIn * reserveOut) / reserveIn;
  const priceImpact = spotOut > 0 ? 1 - expectedOut / spotOut : 0;

  const limit = maxFrontRun(input, minOut);
  const { a, attack } = bestFrontRun(input, limit);
  const netProfit = attack.gross - gasCost;
  const exposed = a > 0 && netProfit > 0;

  return {
    expectedOut,
    minOut,
    priceImpact,
    frontRun: exposed ? a : 0,
    victimOut: exposed ? attack.victimOut : expectedOut,
    victimLoss: exposed ? expectedOut - attack.victimOut : 0,
    grossProfit: exposed ? attack.gross : 0,
    netProfit,
    exposed,
  };
}

export const MAX_SLIPPAGE = 0.5;

/**
 * Highest slippage tolerance at which no sandwich pays after gas, floored to
 * 0.01% so the suggestion is never above the true break-even. Returns
 * MAX_SLIPPAGE when even that is safe.
 */
export function safeSlippage(input: Omit<SwapInput, "slippage">): number {
  const pays = (s: number) => probe({ ...input, slippage: s }).exposed;
  if (!pays(MAX_SLIPPAGE)) return MAX_SLIPPAGE;
  let lo = 0;
  let hi = MAX_SLIPPAGE;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (pays(mid)) hi = mid;
    else lo = mid;
  }
  return Math.floor(lo * 10000) / 10000;
}
