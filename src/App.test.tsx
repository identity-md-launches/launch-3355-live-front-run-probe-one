// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, cleanup, render, screen, within } from "@testing-library/react";
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
    expect(screen.getByText(/Suggested slippage \(rounded down\)/).textContent).toMatch(/0\.37%/);
  });

  it("applies the safe slippage and turns the verdict safe", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Use 0.37% slippage" }));
    expect((screen.getByLabelText("Slippage tolerance (percent)") as HTMLInputElement).value).toBe("0.37");
    expect(status().textContent).toMatch(/Safe: no profitable sandwich in this model/);
    expect(screen.queryByRole("button", { name: /^Use .* slippage$/ })).toBeNull();
    expect(document.activeElement).toBe(status());
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
    const amount = screen.getByLabelText("You sell (token A)");
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

  it("keeps values in the query and restores them from it", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Thin pool" }));
    expect(window.location.search).toBe("?a=5&s=3&x=50&y=150000&f=0.3&g=0.005");
    expect(window.location.hash).toBe("");
    cleanup();
    window.history.replaceState(null, "", "/?a=10&s=0.5&x=20000&y=60000000&f=0.3&g=0.005");
    render(<App />);
    expect((screen.getByLabelText("You sell (token A)") as HTMLInputElement).value).toBe("10");
    expect(status().textContent).toMatch(/Safe/);
  });

  it("keeps the scenario when a section link sets the fragment", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Thin pool" }));
    act(() => {
      window.history.pushState(null, "", "#method");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(window.location.search).toBe("?a=5&s=3&x=50&y=150000&f=0.3&g=0.005");
    expect(window.location.hash).toBe("#method");
    expect((screen.getByLabelText("You sell (token A)") as HTMLInputElement).value).toBe("5");
    cleanup();
    render(<App />); // a reload keeps the query
    expect((screen.getByLabelText("You sell (token A)") as HTMLInputElement).value).toBe("5");
  });

  it("opens an older fragment link and moves it to the query", () => {
    window.history.replaceState(null, "", "/#a=5&s=3&x=50&y=150000&f=0.3&g=0.005");
    render(<App />);
    expect((screen.getByLabelText("You sell (token A)") as HTMLInputElement).value).toBe("5");
    expect(window.location.search).toBe("?a=5&s=3&x=50&y=150000&f=0.3&g=0.005");
    expect(window.location.hash).toBe("");
  });

  it("restores a scenario reached by same-page navigation", () => {
    render(<App />);
    act(() => {
      window.history.pushState(null, "", "/#a=5&s=3&x=50&y=150000&f=0.3&g=0.005");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect((screen.getByLabelText("You sell (token A)") as HTMLInputElement).value).toBe("5");
    expect(window.location.search).toBe("?a=5&s=3&x=50&y=150000&f=0.3&g=0.005");
    act(() => {
      window.history.pushState(null, "", "/?a=2&s=1&x=400&y=1200000&f=0.3&g=0.003");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect((screen.getByLabelText("You sell (token A)") as HTMLInputElement).value).toBe("2");
  });

  it("reads a decimal comma as a decimal and writes the parsed value to the address", async () => {
    const user = userEvent.setup();
    render(<App />);
    const slippage = screen.getByLabelText("Slippage tolerance (percent)");
    await user.clear(slippage);
    await user.type(slippage, "0.5");
    const withDot = status().textContent;
    await user.clear(slippage);
    await user.type(slippage, "0,5");
    expect(slippage.getAttribute("aria-invalid")).toBeNull();
    expect(status().textContent).toBe(withDot);
    expect(new URLSearchParams(window.location.search).get("s")).toBe("0.5");
  });

  it("rejects an ambiguous comma instead of guessing", async () => {
    const user = userEvent.setup();
    render(<App />);
    const reserve = screen.getByLabelText("Pool reserve of A");
    await user.clear(reserve);
    await user.type(reserve, "1,234");
    expect(reserve.getAttribute("aria-invalid")).toBe("true");
    expect(document.getElementById(reserve.getAttribute("aria-describedby")!)?.textContent).toBe(
      "Unclear: write 1234 or 1.234",
    );
  });

  it("names the unit of each field for assistive technology", () => {
    render(<App />);
    for (const name of ["You sell (token A)", "Slippage tolerance (percent)", "Pool fee (percent)", "Attacker gas cost (token A)", "Pool reserve of A", "Pool reserve of B"]) {
      expect(screen.getByRole("textbox", { name })).toBeTruthy();
    }
  });

  it("copies a share link containing the current values", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Copy link to this result" }));
    const copied = await navigator.clipboard.readText();
    expect(copied).toMatch(/\?a=2&s=1&x=400&y=1200000&f=0\.3&g=0\.003$/);
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
