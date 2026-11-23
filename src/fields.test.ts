import { describe, expect, it } from "vitest";
import { parseNumber } from "./fields";

const value = (raw: string) => {
  const r = parseNumber(raw);
  return r.ok ? r.value : r.reason;
};

describe("parseNumber", () => {
  it.each([
    ["0.5", 0.5],
    ["0,5", 0.5],
    [",5", 0.5],
    ["0,500", 0.5],
    ["1,25", 1.25],
    ["1.234", 1.234],
    ["1,200,000", 1200000],
    ["1.200.000", 1200000],
    ["1 200 000", 1200000],
    ["1 234,5", 1234.5],
    ["1 234,567", 1234.567],
    ["1,234.5", 1234.5],
    ["1.234,5", 1234.5],
    ["1e32", 1e32],
    ["1e+32", 1e32],
    ["  7 ", 7],
    ["5.", 5],
  ])("reads %s as %d", (raw, expected) => expect(value(raw)).toBe(expected));

  it.each([
    ["1,234", "ambiguous"],
    ["12,345", "ambiguous"],
    ["", "empty"],
    ["abc", "malformed"],
    ["1,2,3", "malformed"],
    ["1.2.3", "malformed"],
    ["1,23,456", "malformed"],
    ["1.234.5,6", "malformed"],
    ["1,5.2,3", "malformed"],
    ["12 34", "malformed"],
    [".", "malformed"],
    ["1e999", "malformed"],
  ])("rejects %s as %s", (raw, reason) => expect(value(raw)).toBe(reason));
});
