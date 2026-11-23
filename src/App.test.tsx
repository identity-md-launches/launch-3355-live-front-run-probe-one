// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "./App";

beforeEach(() => window.history.replaceState(null, "", "/"));
afterEach(cleanup);

const status = () => screen.getByRole("status");

describe("App", () => {
  it("starts on the mid pool example and reports exposure", () => {
    render(<App />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveProperty("textContent", "Will your swap get sandwiched?");
    expect(status().textContent).toMatch(/Exposed: a sandwich nets/);
    expect(screen.getByText(/Highest safe slippage/).textContent).toMatch(/0\.37%/);
  });

  it("applies the safe slippage and turns the verdict safe", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Use 0.37% slippage" }));
    expect((screen.getByLabelText("Slippage tolerance") as HTMLInputElement).value).toBe("0.37");
    expect(status().textContent).toMatch(/Safe: no sandwich pays after gas/);
    expect(screen.queryByRole("button", { name: /^Use .* slippage$/ })).toBeNull();
  });

  it("loads each example pool", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Deep pool" }));
    expect((screen.getByLabelText("Pool reserve of A") as HTMLInputElement).value).toBe("20000");
    expect(status().textContent).toMatch(/Safe/);
    expect(screen.getByText(/No sandwich pays at any slippage up to 50%/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Thin pool" }));
    expect((screen.getByLabelText("Pool reserve of A") as HTMLInputElement).value).toBe("50");
    expect(status().textContent).toMatch(/Exposed/);
  });

  it("recomputes live as the swap size changes", async () => {
    const user = userEvent.setup();
    render(<App />);
    const amount = screen.getByLabelText("You sell");
    await user.clear(amount);
    await user.type(amount, "0.1");
    expect(status().textContent).toMatch(/Safe/);
  });

  it("shows an inline error, marks the field invalid and recovers", async () => {
    const user = userEvent.setup();
    render(<App />);
    const reserve = screen.getByLabelText("Pool reserve of B");
    await user.clear(reserve);
    expect(reserve.getAttribute("aria-invalid")).toBe("true");
    const errorId = reserve.getAttribute("aria-describedby")!;
    expect(document.getElementById(errorId)?.textContent).toBe("Enter a reserve above 0");
    expect(status().textContent).toBe("Fix the highlighted field to see the result.");
    await user.type(reserve, "1,200,000");
    expect(reserve.getAttribute("aria-invalid")).toBeNull();
    expect(status().textContent).toMatch(/Exposed/);
  });

  it("keeps values in the address and restores them from it", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Thin pool" }));
    expect(window.location.hash).toBe("#a=5&s=3&x=50&y=150000&f=0.3&g=0.005");
    cleanup();
    window.history.replaceState(null, "", "/#a=10&s=0.5&x=20000&y=60000000&f=0.3&g=0.005");
    render(<App />);
    expect((screen.getByLabelText("You sell") as HTMLInputElement).value).toBe("10");
    expect(status().textContent).toMatch(/Safe/);
  });

  it("copies a share link containing the current values", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Copy link to this result" }));
    const copied = await navigator.clipboard.readText();
    expect(copied).toMatch(/#a=2&s=1&x=400&y=1200000&f=0\.3&g=0\.003$/);
    expect(screen.getByRole("button", { name: "Link copied" })).toBeTruthy();
  });

  it("lists every result figure", () => {
    render(<App />);
    const figures = document.querySelector("dl.figures") as HTMLElement;
    for (const term of ["Expected output", "Lowest output you accept", "Price impact", "Best front-run size", "Your loss to the sandwich", "Attacker profit after gas"]) {
      expect(within(figures).getByText(term)).toBeTruthy();
    }
  });
});
