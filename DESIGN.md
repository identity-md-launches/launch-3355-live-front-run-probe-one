# Sandwich Probe design system

Source of truth: `src/styles.css` (all tokens and component classes) and `src/App.tsx` (markup). There is no
theme file, CSS-in-JS or component library; everything below is read from those two files.

## Overview

Sandwich Probe is a one-page tool for traders checking whether a swap on a constant-product pool can be
profitably front-run (sandwiched) within their slippage tolerance. It is read to get a task done, so the
page is calm and dense: a short headline, one plain line, then the tool itself. There is no marketing hero
and no decoration beyond the favicon mark.

Hierarchy comes from size and weight, not colour. Colour is reserved for three jobs: the one filled
primary action (indigo), the verdict state (red tint for exposed, green tint for safe) and focus rings.
Everything else is the cool neutral ramp.

Composition rules that apply to any further page:

- The product (inputs and answer) sits directly under a one-line intro; nothing pushes it below the
  first screen at 390 px.
- Inputs come before results in DOM and reading order; on wide screens they sit side by side.
- Long-form text is capped at `40rem` and set in the secondary text colour.

## Colors

Notation is `oklch()` throughout. Primitives (`--gray-*`, `--indigo-*`, `--red-*`, `--green-*`,
`src/styles.css:4-17`) are never used in components; components use only the semantic tokens
(`src/styles.css:20-37`).

| Semantic token | Primitive | Value | Use |
| --- | --- | --- | --- |
| `--color-bg` | `--gray-50` | `oklch(0.985 0.003 250)` | Page background |
| `--color-surface` | `--gray-0` | `oklch(1 0 0)` | Panels, inputs, chips, secondary button, formula block |
| `--color-border` | `--gray-200` | `oklch(0.91 0.008 250)` | Panel and formula outlines (structure only) |
| `--color-border-strong` | `--gray-400` | `oklch(0.64 0.014 250)` | Control boundaries: inputs, chips, secondary button |
| `--color-text` | `--gray-900` | `oklch(0.22 0.02 250)` | Headings, body, values |
| `--color-text-secondary` | `--gray-600` | `oklch(0.48 0.018 250)` | Lede, hints, units, figure terms, method prose, footer |
| `--color-accent-solid` | `--indigo-600` | `oklch(0.5 0.18 268)` | Fill of the one primary button |
| `--color-accent-solid-hover` | `--indigo-700` | `oklch(0.43 0.17 268)` | Primary button hover |
| `--color-accent-text` | `--indigo-700` | `oklch(0.43 0.17 268)` | Links |
| `--color-on-accent` | `--gray-0` | `oklch(1 0 0)` | Text on the primary fill |
| `--color-focus` | `--indigo-600` | `oklch(0.5 0.18 268)` | Focus rings |
| `--color-danger-bg` / `-border` / `-text` | `--red-50` / `-200` / `-700` | see source | Exposed verdict panel, field errors |
| `--color-safe-bg` / `-border` / `-text` | `--green-50` / `-200` / `-700` | see source | Safe verdict panel |

Contrast, computed from these declared values with an OKLCH to sRGB conversion (WCAG relative luminance;
script kept outside the delivery): text on bg 16.57:1; secondary text on surface 6.52:1, on bg 6.25:1, on
danger bg 5.92:1, on safe bg 6.03:1; danger text on danger bg 6.77:1; safe text on safe bg 6.52:1; white on
accent fill 6.28:1; link colour on bg 8.14:1; control border on surface 3.36:1 (WCAG 1.4.11 needs 3:1);
focus ring on surface 6.28:1 and on danger bg 5.70:1.

There is no dark theme (`color-scheme: light`).

## Typography

- Family: the system UI stack `system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial,
  sans-serif` (`src/styles.css` `body`). No web fonts are loaded, so the exact face depends on the OS.
- Monospace (`ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`) is used only for the formula
  in `.formula`.
- Weights: 400 (body), 600 (labels, h2, values, buttons, brand), 700 (h1 only).
- Numbers that change (`.num`, inputs, verdict, figures) use `font-variant-numeric: tabular-nums`.

| Token | Size | Line height | Role |
| --- | --- | --- | --- |
| `--text-caption` | 0.8125rem (13px) | 1.4 | Hints, errors, input units, figure terms, footer |
| `--text-label` | 0.875rem (14px) | 1.5 | Field labels, chips, header link, formula |
| `--text-body` | 1rem (16px) | 1.5 | Body, inputs (16px prevents iOS zoom), buttons, figure values |
| `--text-title` | 1.25rem (20px) | 1.2 (h2), 1.3 (verdict) | Section headings, verdict title |
| `--text-display` | 1.75rem (28px); 2.5rem (40px) from 60rem | 1.1, letter-spacing −0.02em | The page h1 only |

Headings use `text-wrap: balance`; paragraphs use `text-wrap: pretty`. Body text uses natural case and
letter-spacing; there are no uppercase labels.

## Layout

- Spacing is a 4px scale: `--space-1` 4px, `-2` 8px, `-3` 12px, `-4` 16px, `-5` 20px, `-6` 24px,
  `-8` 32px, `-12` 48px. Gaps inside a group use 4 to 12px; gaps between groups use 16px or more.
- Page width: header, `main` and footer share one container, `max-width: var(--page-max)` (72rem) with
  `padding-inline: var(--gutter)`. `--gutter` is 16px, 24px from 40rem.
- `.workspace`: one column; from 56rem two columns `minmax(0, 1.15fr) minmax(0, 1fr)` with 24px gap,
  inputs left, results right, top-aligned. `.workspace > .panel` sets `min-width: 0` so a panel never
  widens its grid track.
- Long numbers wrap: `.verdict-title`, `.verdict-body`, `.safe-row p` and `.figure dd` use
  `overflow-wrap: anywhere` (with `min-width: 0`), so an amount such as a 1e32 reserve stays fully
  visible across lines inside the panel instead of pushing it past the viewport.
- `.field-grid` and `.figures`: always two equal columns (`minmax(0, 1fr)`), so labels wrap rather than
  overflow at 320px.
- `.panel` padding: 16px, 24px from 40rem.
- Logical properties (`padding-inline`, `margin-inline`, `padding-inline-end`) are used for
  direction-dependent spacing.

Observed in Chromium (Playwright) at 320, 390 and 1440 wide: no horizontal scroll; at 390x844 the inputs
and the verdict are both on the first screen (verdict top at 676px; at 320 wide it is at 787px). With
the Mid pool and a 1e32 reserve of B, `scrollWidth` stays 320 at 320 wide and both panels end at 304px.

## Elevation & Depth

Deliberately flat. No shadows anywhere. Depth is a tonal step (`--color-bg` page, `--color-surface`
panels) plus a 1px `--color-border` outline. The results panel replaces its own background and border
with the danger or safe tint rather than nesting a coloured card inside it, so there are no cards inside
cards.

## Shapes

- `--radius-control` 0.5rem: inputs, buttons, formula block.
- `--radius-panel` 0.875rem: `.panel`.
- Chips are fully rounded (`border-radius: 999px`).
- Every control has a visible 1px boundary (`--color-border-strong`) or a solid fill.

## Components

All in `src/App.tsx` with styles in `src/styles.css`. They are local patterns, not exported library
components.

- **Site header** (`.site-header`, `.brand`, `.header-link`): brand mark and name at the leading edge
  linking to `#top`; "How it works" link at the trailing edge. Both are at least 44px tall.
- **Panel** (`.panel`): white surface, 1px border, panel radius. Variants via `data-state` on the results
  panel: `idle`, `exposed`, `safe` (`src/styles.css` `.results[data-state=…]`).
- **Chip** (`.chip`): secondary action that loads example values. 40px tall, pill shape.
- **Field** (`Field` in `src/App.tsx`, `.field`, `.input-wrap`, `.unit`, `.field-hint`, `.field-error`):
  visible `<label for>`, text input with `inputMode="decimal"`, unit suffix inside the box (hidden from
  assistive tech). Where the label does not already name the unit, a visually hidden `(token A)` or
  `(percent)` is added to the label, so the accessible names are "You sell (token A)", "Slippage
  tolerance (percent)", "Pool fee (percent)" and "Attacker gas cost (token A)". Values accept a decimal
  point or a decimal comma and grouped thousands (`parseNumber` in `src/fields.ts`); an ambiguous
  "1,234" shows "Unclear: write 1234 or 1.234". Error state sets `aria-invalid`, a red border, and
  replaces the hint with the error text linked by `aria-describedby`. Focus ring is drawn on the wrapper
  via `:focus-within`.
- **Primary button** (`.button-primary`): the single filled action per view ("Use 0.37% slippage"),
  beside "Suggested slippage (rounded down): 0.37%". 44px tall. Only rendered when it would change
  something. Activating it moves focus to the verdict.
- **Secondary button** (`.button-secondary`): outlined; "Copy link to this result", which swaps its label
  to "Link copied" for 2 seconds.
- **Verdict** (`.verdict-region` with `role="status"`): a stable polite live region whose text updates
  on every change. Exposed and safe titles pair colour with an icon and the words "Exposed" or "Safe"
  ("Safe: no profitable sandwich in this model"). It has `tabIndex={-1}` so focus can land on it after
  the suggestion is applied; its `:focus-visible` ring is offset 4px with the control radius.
- **Figures** (`.figures`, `Figure`): a `<dl>` of term (caption, secondary) over value (body, 600,
  tabular).
- **Formula** (`.formula`): monospace code block for one equation.

Interaction states: buttons scale to 0.96 on press with a 150ms `cubic-bezier(0.2, 0, 0, 1)` transition
of named properties only; reduced motion removes the transform. Hover styles are gated by
`@media (hover: hover)`. Focus uses `:focus-visible` with a 2px `--color-focus` outline.

## Do's and Don'ts

- Do start a new page from the shared container (`.site-header`, `main`, `.site-footer`) and `.panel`.
- Do keep one filled `.button-primary` per view; everything else is `.button-secondary` or `.chip`.
- Do use the `--color-danger-*` / `--color-safe-*` families only for verdict and validation state, always
  with a text or icon cue.
- Do add a semantic token when a role is missing; don't reference a primitive from a component.
- Don't add sizes outside the five `--text-*` tokens or weights outside 400/600/700.
- Don't add shadows, gradients, uppercase kicker labels or a coloured card inside a panel.
- Recipe for another tool page: header, an `.intro` with one h1 and one `.lede` line, a `.workspace`
  with an inputs `.panel` built from `Field` and a results `.panel` with a `role="status"` region and a
  `.figures` list, then an optional `.method` section and the footer.
