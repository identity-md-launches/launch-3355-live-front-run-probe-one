import { describe, expect, it } from "vitest";
import { MAX_SLIPPAGE, amountOut, probe, safeSlippage } from "./sandwich";

const mid = { amountIn: 2, reserveIn: 400, reserveOut: 1_200_000, fee: 0.003, slippage: 0.01, gasCost: 0.003 };
const deep = { amountIn: 10, reserveIn: 20_000, reserveOut: 60_000_000, fee: 0.003, slippage: 0.005, gasCost: 0.005 };

describe("amountOut", () => {
  it("matches the constant-product formula with the fee on the input", () => {
    // 1 × 0.997 × 1000 / (1000 + 0.997)
    expect(amountOut(1, 1000, 1000, 0.003)).toBeCloseTo(0.996007, 6);
  });
  it("returns 0 for a zero or negative input", () => {
    expect(amountOut(0, 10, 10, 0.003)).toBe(0);
    expect(amountOut(-1, 10, 10, 0.003)).toBe(0);
  });
});

describe("probe", () => {
  it("flags a mid-size pool swap at 1% slippage as exposed", () => {
    const r = probe(mid);
    expect(r.exposed).toBe(true);
    expect(r.netProfit).toBeGreaterThan(0);
    // The attack never pushes the victim below the minimum they accept.
    expect(r.victimOut).toBeGreaterThanOrEqual(r.minOut - 1e-6);
    expect(r.victimLoss).toBeCloseTo(r.expectedOut - r.victimOut, 9);
  });

  it("keeps a small swap on a deep pool safe", () => {
    const r = probe(deep);
    expect(r.exposed).toBe(false);
    expect(r.frontRun).toBe(0);
    expect(r.victimOut).toBe(r.expectedOut);
  });

  it("is never exposed at zero slippage", () => {
    expect(probe({ ...mid, slippage: 0, gasCost: 0 }).exposed).toBe(false);
  });

  it("gives a larger attacker profit as slippage grows", () => {
    const low = probe({ ...mid, slippage: 0.01 }).netProfit;
    const high = probe({ ...mid, slippage: 0.03 }).netProfit;
    expect(high).toBeGreaterThan(low);
  });
});

describe("safeSlippage", () => {
  it("returns a slippage that is safe while a step above it is not", () => {
    const s = safeSlippage(mid);
    expect(s).toBeGreaterThan(0);
    expect(s).toBeLessThan(0.01);
    expect(probe({ ...mid, slippage: s }).exposed).toBe(false);
    expect(probe({ ...mid, slippage: s + 0.0002 }).exposed).toBe(true);
  });

  it("returns the cap when no slippage up to it is exploitable", () => {
    expect(safeSlippage(deep)).toBe(MAX_SLIPPAGE);
  });
});
