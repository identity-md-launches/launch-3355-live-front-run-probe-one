# Sandwich Probe

A one-page tool that checks a swap for front-running. Enter a swap on a constant-product (Uniswap v2
style) pool and it computes, live as you type, how much a sandwich attacker could take within your
slippage tolerance, and the highest slippage at which no sandwich pays after the attacker's gas.

- Everything is computed in the browser from what you type. Nothing is read from a chain, and there is
  no backend, wallet or API key.
- The three example pools are illustrations, not live reserves.
- The page address keeps the current values (`#a=…&s=…`), so a copied link reopens the same result.

## Layout

| Path | What it is |
| --- | --- |
| `index.html` | HTML shell: title, description, favicon, Open Graph tags |
| `src/sandwich.ts` | The model: swap output, best front-run search, safe-slippage search |
| `src/fields.ts` | Field definitions, validation, example pools, address-hash encoding |
| `src/format.ts` | Number and percent formatting |
| `src/App.tsx` | The page |
| `src/styles.css` | Design tokens and component styles (see `DESIGN.md`) |
| `src/*.test.ts(x)` | Unit tests for the model and interaction tests for the page |
| `public/` | `favicon.svg` and the `og.png` share image, copied into `dist/` |
| `dist/` | The committed static export that is published as is |
| `artifacts/validation.md` | Design review coverage, findings and full check results |

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
single page with in-page anchors only, so no server rewrites are needed. After changing source, run
`npm run build` and commit the regenerated `dist/` together with the source.

## How the model works

For a pool with reserves A and B and fee f, a swap of `in` A returns
`in × (1 − f) × B ÷ (A + in × (1 − f))`, and the whole input joins the reserves. The attacker buys B with
`a` A just before your swap, your swap fills, then the attacker sells that B back. Your slippage sets the
lowest output you accept, so `a` can only grow until you would receive exactly that minimum. The probe
finds that cap by bisection, searches every front-run size up to it (200 samples plus golden-section
refinement) for the highest profit, and subtracts the attacker's gas. The safe slippage is found by
bisection over 0 to 50% and rounded down to 0.01%.

Assumptions: one attacker, no other pending trades, a public mempool, and gas given in token A. Real
pools with concentrated liquidity (v3), other fee models or private order flow behave differently.

## Checks run

Run on this machine after the last source change (details and screenshots list in
`artifacts/validation.md`):

| Check | Command | Result |
| --- | --- | --- |
| Typecheck | `npx tsc --noEmit` | passed, no errors |
| Production build | `npm run build` | passed; `dist/index.html` 1.24 kB, CSS 7.59 kB, JS 230.08 kB (72.33 kB gzip) |
| Unit and interaction tests | `npx vitest run` | 2 files, 16 tests passed |
| Browser interactions on the export | Playwright script (kept outside the repo) serving `dist/` under `/preview/` in Chromium at 320, 390 and 1440 | 37 of 37 checks passed |
| Design probe | `node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste` | 16 of 16 checks passed |

The interaction tests cover: the default verdict, applying the suggested safe slippage, loading each
example pool, live recompute while typing, inline validation with `aria-invalid` and recovery, writing
and restoring values from the address, and copying the share link. The browser run repeats those flows
on the built export and also checks horizontal overflow, that the inputs and verdict are on the first
screen, the keyboard tab order and its focus outlines, console errors, failed requests, and the
reduced-motion style.

Not performed: WebKit/Safari and Firefox runs, physical devices, a screen reader session, native 200%
browser zoom and an RTL mirror. The design probe could not measure contrast for some text boxes; the
declared colour pairs were computed instead (see `DESIGN.md`).
