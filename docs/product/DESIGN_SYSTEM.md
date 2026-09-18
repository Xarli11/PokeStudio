# PokeLab — Design System (Brand 1.0)

**Figma is the visual source of truth.** The official identity was designed there; the
exported SVGs under `apps/web/public/brand/` are canonical assets, not references to
redraw from. This document is the implementation companion — how that identity maps onto
tokens, components and code — not a second design authority. If this document and Figma
ever disagree, Figma wins and this document is wrong.

## Brand personality

- clean
- modern
- purposeful
- elegant
- premium
- technical
- slightly futuristic
- dark-first
- restrained
- generous spacing
- strong contrast
- emerald used deliberately, not everywhere

Avoid: purple/blue SaaS styling, cyberpunk, excessive neon, gaming-HUD clichés,
glassmorphism everywhere, excessive gradients, random futuristic decoration.

## Palette

### Layer 1 — brand primitives (fixed, from Figma)

| Token                   | Hex       | Role                                                |
| ----------------------- | --------- | --------------------------------------------------- |
| `--pl-brand-emerald`    | `#10B981` | Primary brand accent (dark mode)                    |
| `--pl-brand-mint`       | `#34D399` | Secondary accent, hover states, focus ring          |
| `--pl-brand-deep`       | `#047857` | Primary brand accent (light mode, AA text contrast) |
| `--pl-neutral-charcoal` | `#0A0D0C` | Darkest neutral — dark-mode page background         |
| `--pl-neutral-graphite` | `#151A18` | Dark-mode surface neutral                           |
| `--pl-neutral-light`    | `#F3F7F5` | Light-mode page background / dark-mode text         |

Components must never reference these six values directly (or any other raw hex) — always
go through the Layer 2 semantic tokens below, defined in `packages/ui/src/tokens.css`.
Verified against the Figma exports: the same six hex values appear literally inside the
official SVGs (e.g. `#0A0D0C`/`#10B981` in `pokestudio-favicon-32.svg`), confirming the
token file and the Figma source agree.

### Layer 2 — semantic application tokens

| Token                                                             | Purpose                                                  |
| ----------------------------------------------------------------- | -------------------------------------------------------- |
| `--pl-color-bg`                                                   | Page canvas                                              |
| `--pl-color-bg-elevated`                                          | A step above canvas (e.g. evolution-chain rows)          |
| `--pl-color-bg-surface`                                           | Card/panel surfaces                                      |
| `--pl-color-bg-hover` / `--pl-color-bg-active`                    | Interactive surface states                               |
| `--pl-color-border` / `--pl-color-border-subtle`                  | Outlines and internal dividers                           |
| `--pl-color-text` / `--pl-color-text-muted`                       | Foreground text                                          |
| `--pl-color-primary`                                              | Product accent — active nav, links, primary actions      |
| `--pl-color-primary-hover`                                        | Hover state for primary/accent surfaces                  |
| `--pl-color-primary-contrast`                                     | Text/icon color on top of `--pl-color-primary`           |
| `--pl-color-primary-soft`                                         | Low-opacity accent wash (hidden-ability tag, soft fills) |
| `--pl-color-focus`                                                | `:focus-visible` outline color                           |
| `--pl-color-success` / `--pl-color-warning` / `--pl-color-danger` | Feedback states (not brand accents)                      |

## Dark / light rules

Dark is the default and primary theme: Charcoal background, Graphite surfaces, Emerald
accent (Mint for hover/focus). Light mode is **designed on its own terms**, not an
inverted dark theme: Light neutral background, pure white surfaces, and the accent
deepens to Deep Green — measured, not assumed, at 5.07:1 against the Light background and
5.48:1 for white text on a Deep Green fill, both comfortably above the 4.5:1 AA text
threshold. (Dark mode: Emerald on Charcoal measures 7.70:1; Light neutral text on
Charcoal measures 18.06:1.) Both themes are declared in one place
(`packages/ui/src/tokens.css`); the `data-theme` attribute switches between them, set by
an inline pre-hydration script (see "Hydration" below) so there's no flash of the wrong
theme — the header logo swap (see "Logo" below) uses the same attribute.

## Pokémon type-color relationship

Pokémon type colors (`--pl-type-*`, 18 tokens) are a **separate semantic system** for
Pokémon data — fire badges, water accents, etc. — and are never the brand palette. A type
color may tint a card's accent seam or a type badge; it must never be used for product
chrome (nav, buttons, primary actions), and brand Emerald must never stand in for the
Grass type or vice versa. Checked by hue, not assumption: brand Emerald/Mint/Deep sit at
hue ~158–163° (a cyan-leaning green); `--pl-type-grass` sits at hue 128° (a warmer
yellow-green, ~30° away) and `--pl-type-bug` at hue 72° (yellow-olive, ~90° away) — both
clearly distinguishable from the brand accent by role and by eye. Never turn every
Pokémon card the same brand color either — the type identity is part of what makes a card
_that Pokémon's_ card, even though the card's structural styling (surface, spacing,
radius) is unmistakably PokeLab's own.

## Typography

**Inter** throughout the product, self-hosted via `next/font` (no external font request,
no extra dependency). Three weights only:

- **Bold (700)** — major titles, strong identity (page `<h1>`, base-stat totals)
- **Semibold (600)** — navigation, card Pokémon names, section emphasis, labels
- **Regular (400)** — body copy, descriptions, secondary metadata

No other weight is used anywhere in the product (audited: every `font-weight`/`fontWeight`
in `apps/web/src/**` is 400, 600 or 700). Numerical/stat displays use
`font-variant-numeric: tabular-nums` so digits stay aligned and scannable.

## Logo

PokeLab retains the existing Figma-exported symbol, emerald palette and Inter typography.
All original SVG files and filenames remain unchanged pending the owner’s new Figma exports.
The header pairs a decorative symbol with live **PokeLab** lettering (Inter Semibold).
The original wordmark/compact SVGs contain outlined “Studio” glyphs. They remain in the
repository, but the header does not render them. The owner will change the logo in Figma
and provide new exports; renaming a file cannot change its visible lettering.
The source Figma file has not been modified or described as newly approved artwork.

| Variant          | File                                  | Use                 |
| ---------------- | ------------------------------------- | ------------------- |
| Master           | `pokestudio-symbol-primary.svg`       | Header, light theme |
| Dark             | `pokestudio-symbol-on-dark.svg`       | Header, dark theme  |
| Monochrome Light | `pokestudio-symbol-mono-on-light.svg` | Reserved            |
| Monochrome Dark  | `pokestudio-symbol-mono-on-dark.svg`  | Reserved            |
| Favicon 16       | `pokestudio-favicon-16.svg`           | Browser icon        |
| Favicon 32       | `pokestudio-favicon-32.svg`           | Browser icon        |

The all-emerald `pokestudio-symbol-light.svg` remains unregistered because its original
Figma variant mapping is ambiguous. Both registered header symbols share a grid cell;
CSS selects the theme without JavaScript or hydration changes. Their paths are listed
in `apps/web/src/lib/brand-assets.ts`. Preserve their geometry and colors.

## Spacing / surface principles

- One shared spacing scale (`--pl-space-1` … `--pl-space-8`) — no ad hoc rem values.
- Prefer dividers/spacing over nesting another `.ps-card` inside a card ("box inside box").
- Cards (`.ps-card`) use `--pl-color-bg-surface` with a subtle border and soft shadow —
  never a flat, borderless block, and never full-bleed brand-color fills.

## Iconography

Direction only — no icon library has been added. Outline style, consistent stroke
weight, clean geometry, Emerald/Mint interaction states, no mixed icon styles, no filled
icons next to outlined ones. Figma establishes this direction for future product-area
icons (Explore, Build, Battle Lab, Analysis, Community, More); do not build out any of
those unfinished areas just to show their icon.

## Motion principles

Subtle, purposeful, fast, native-feeling — never ornamental for its own sake. State
transitions, hover/focus feedback, hierarchy. No animation library. Every
transform/animation respects `prefers-reduced-motion: reduce` (see `tokens.css` and
`globals.css`). The official SVG logo is never animated internally unless a Figma-
approved animated variant is designed later.

## Accessibility

- The brand link's accessible name is the string "PokeLab" (an `aria-label` on the
  `<Link>`); both logo images are decorative (`alt=""`) so the name isn't announced twice.
- Semantic heading hierarchy preserved on every page.
- Visible focus via `--pl-color-focus` on every interactive element.
- Color is never the only carrier of meaning (type badges always show the localized label).
- Universal Pokédex numbering (`#001`, `#133`, …) is a product identifier, not translated
  prose — same format in every locale.

## Hydration

`<html suppressHydrationWarning>` in `apps/web/src/app/[locale]/layout.tsx` is scoped to
exactly one attribute, `data-theme`, which an inline script sets pre-hydration from
`localStorage`/system preference (unavailable during SSR, so the server never renders it).
Do not broaden `suppressHydrationWarning` to cover anything else or apply it elsewhere.
The logo's theme swap is pure CSS keyed off this same attribute, so it introduces no
additional hydration risk.

## What NOT to do

- Do not redraw, reinterpret, simplify, normalize or recolor the official logo geometry
  in code — Figma and its exports are the only source for that artwork.
- Do not scatter raw hex values in components — always go through Layer 2 tokens.
- Do not reuse a Pokémon type color as brand/product chrome, or vice versa.
- Do not reintroduce excessive neon, glassmorphism, cyberpunk, or gaming-HUD treatments.
- Do not add decorative gradients everywhere — the one ambient page wash in `globals.css`
  is deliberate and should stay the exception, not the pattern.
- Do not create a Poké Ball–derived logo, or imitate official Pokémon visual identity.
- Do not use arbitrary font weights outside Inter Regular/Semibold/Bold.
- Do not plaster brand slogans throughout the application — product copy stays sparing.
