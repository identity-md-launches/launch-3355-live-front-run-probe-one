# Sandwich Probe

A one-page tool that checks a swap for front-running. Enter a swap on a constant-product (Uniswap v2
style) pool and it computes, live as you type, how much a sandwich attacker could take within your
slippage tolerance, and a suggested slippage (rounded down) at which no sandwich pays after the
attacker's gas.

- Everything is computed in the browser from what you type. Nothing is read from a chain, and there is
  no backend, wallet or API key.
- The three example pools are illustrations, not live reserves.
- The page address keeps the current values in the query (`?a=…&s=…`), so a copied link reopens the
  same result. Fragments are left to the in-page links (`#method`, `#top`). Older `#a=…` links still
  open and are moved to the query; back/forward and same-tab scenario links restore their scenario.
- Inputs accept a decimal point or comma (`0.5` or `0,5`) and grouped thousands (`1,200,000`,
  `1.200.000`, `1 200 000`). An ambiguous `1,234` is rejected with a prompt to write `1234` or `1.234`.

## Layout

| Path | What it is |
| --- | --- |
| `index.html` | HTML shell: title, description, favicon, Open Graph tags |
| `src/sandwich.ts` | The model: swap output, best front-run search, safe-slippage search |
| `src/fields.ts` | Field definitions, number parsing and validation, example pools, address query encoding |
| `src/format.ts` | Number and percent formatting |
| `src/App.tsx` | The page |
| `src/styles.css` | Design tokens and component styles (see `DESIGN.md`) |
| `src/*.test.ts(x)` | Unit tests for the model and interaction tests for the page |
| `public/` | `favicon.svg` and the `og.png` share image, copied into `dist/` |
| `dist/` | The committed static export that is published as is |
| `artifacts/validation.md` | Design review coverage, findings, revision responses and full check results |

## Install, preview and rebuild

Requires Node 20 or newer (built with Node 24.21 and npm 11.19).

```sh
npm ci               # install exactly what package-lock.json pins
npm run dev          # local dev server with hot reload
npm run build        # typecheck (tsc --noEmit), then write the static export to dist/
npm run preview      # serve the built dist/ locally
npm test             # vitest: model unit tests and page interaction tests
npm run typecheck    # tsc --noEmit on its own
```

`vite.config.ts` sets `base: "./"`, so every URL in `dist/index.html` is relative (`./assets/…`,
`./favicon.svg`) and the export works from any folder, an IPFS gateway subpath or an ENS name. It is a
single page with in-page anchors and a query string only, so no server rewrites are needed. After changing source, run
`npm run build` and commit the regenerated `dist/` together with the source.

## How the model works

For a pool with reserves A and B and fee f, a swap of `in` A returns
`in × (1 − f) × B ÷ (A + in × (1 − f))`, and the whole input joins the reserves. The attacker buys B with
`a` A just before your swap, your swap fills, then the attacker sells that B back. Your slippage sets the
lowest output you accept, so `a` can only grow until you would receive exactly that minimum. The probe
finds that cap by bisection, searches for the most profitable front-run size within it (200 evenly spaced
samples, then golden-section refinement around the best sample), and subtracts the attacker's gas. The
suggested slippage is the break-even found by bisection over 0 to 50%, rounded down to 0.01 percentage
points, so a swap can be marked safe at a value slightly above the suggestion.

Assumptions: one attacker, no other pending trades, a public mempool, and gas given in token A. Real
pools with concentrated liquidity (v3), other fee models or private order flow behave differently.

## Checks run

Run on this machine after the last source change (revision 2; details in `artifacts/validation.md`):

| Check | Command | Result |
| --- | --- | --- |
| Typecheck | `npx tsc --noEmit` | passed, no errors |
| Production build | `npm run build` | passed; `dist/index.html` 1.24 kB, CSS 7.80 kB, JS 232.23 kB (73.05 kB gzip) |
| Unit and interaction tests | `npx vitest run` | 3 files, 51 tests passed |
| Browser checks on the export | Playwright script (kept outside the repo) serving `dist/` under `/preview/` in Chromium at 320, 390 and 1440 | 43 of 43 checks passed |
| Design probe | `node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste` | 16 of 16 checks passed |

The interaction tests cover: the default verdict, applying the suggested slippage (and that focus lands
on the verdict), loading each example pool, live recompute while typing, inline validation with
`aria-invalid` and recovery, decimal-comma and ambiguous-comma input, the query/fragment split
(section links, reload, older fragment links, back/forward), units in accessible names, and copying the
share link. `src/fields.test.ts` covers 29 parser cases. The browser run repeats those flows on the built
export (including the `fr-FR` locale and a real Tab/Enter keyboard path) and checks horizontal overflow
with 1e29, 1e32 and 1e60 reserves, that the inputs are on the first screen, console errors and failed
requests.

Not performed: WebKit/Safari and Firefox runs, physical devices, a screen reader session, native 200%
browser zoom and an RTL mirror. Browser checks used Playwright's Chromium headless shell.
