# ADR-0012: Adopt Tailwind CSS 4 as the primary styling system

- Status: Accepted
- Date: 2026-09-11

## Context

Through UX/UI 0.1–0.2c and Brand 1.0, `apps/web` styled itself with CSS Modules (4 files:
`app-shell`, `pokemon-grid`, `form-section`, `evolution-section`) plus, more often, inline
`style={{ ... }}` objects referencing PokeLab's own CSS custom properties
(`packages/ui/src/tokens.css`, `--pl-color-*` / `--pl-space-*` / `--pl-radius-*` etc.). That
token layer was already the actual design-system source of truth — the inline-style approach
was simply the delivery mechanism, and it scaled poorly: every layout tweak meant hand-writing
a new `style` object, spacing/typography values were retyped per call site instead of drawn
from a shared scale, and there was no single place to see "every color/radius/shadow this
product uses."

Styling Foundation 1.0 asks for a deliberate, production-quality migration to Tailwind CSS 4 as
the long-term styling foundation, explicit that **Tailwind is not to replace PokeLab's design
system** — the existing `--pl-*` tokens must remain the one source of truth, with Tailwind
consuming them rather than duplicating them.

## Decision

Adopt Tailwind CSS 4 (`tailwindcss` + `@tailwindcss/postcss`, CSS-first configuration — no
`tailwind.config.js`) as the primary styling system for `apps/web`.

Architecture:

```
Figma / Brand decisions
        ↓
packages/ui/src/tokens.css   (--pl-* custom properties — dark default, [data-theme='light'] override)
        ↓  (one @theme block, alias-only: every line a var() reference, never a new value)
Tailwind CSS 4 utilities     (bg-surface, text-muted, rounded-lg, shadow-glow, sm:/md:/lg:/xl:, ...)
        ↓
React components (apps/web)
```

The `@theme` block lives inside `tokens.css` itself (not `globals.css`) — it is conceptually
part of the token package, and colocating it there means `packages/ui` stays the single file
that defines PokeLab's design system, Tailwind-facing names included. Because every aliased
property (`--color-brand: var(--pl-color-primary)`, etc.) references a custom property that
already lives at `:root` / `[data-theme='light']`, theme switching keeps working exactly as
before — a `bg-brand` utility re-resolves live through the CSS cascade when `data-theme`
changes, no JS, no duplicated theme definition.

Also folded into the `@theme` block: `--breakpoint-sm/md/lg/xl` are redefined to the app's
existing intentional tiers (480/800/1100/1200px, previously several different one-off
`@media` values scattered per component) — one shared breakpoint scale reused by the grid,
the AppShell navbar, and typography, instead of an "explosion of arbitrary media queries."

Tailwind's own dynamic spacing scale (`--spacing: 0.25rem` × n, built in) already reproduces
the old `--pl-space-1..8` scale exactly (1/2/3/4/6/8/12/16 → 0.25–4rem) — so spacing is
deliberately **not** re-aliased into a parallel token; using Tailwind's native `gap-*`/`p-*`
utilities directly is the single source of truth, and the redundant `--pl-space-*` variables
were deleted.

All 4 CSS Modules were removed — none needed the "concrete technical reason" bar (complex
keyframes, special SVG internals, selector behavior Tailwind can't express) that would justify
keeping one; their layouts are all expressible with grid/flex utilities (`col-start-*`,
`order-*`/`basis-*`, arbitrary `grid-cols-[...]` where a structural template has no token
equivalent).

Per-type dynamic values (a Pokémon's type, chosen at runtime from data, driving a
`color-mix()` wash/border) stay as inline `style` referencing the same `--pl-type-*` custom
properties — a static Tailwind utility class cannot express a value selected at runtime, so
this is not a regression, just the correct tool for a genuinely dynamic case. It remains
100% token-driven; no hardcoded hex was introduced.

## Alternatives considered

- **Stay on CSS Modules + inline styles**: rejected — this is exactly the problem being
  solved; no shared utility vocabulary, and every spacing/color value is retyped by hand at
  each call site with no compiler-enforced consistency.
- **Tailwind v3 with a JS config**: rejected — v4's CSS-first `@theme` is a strictly better fit
  for a project whose design tokens already live in plain CSS custom properties; a JS config
  would mean maintaining the same values in two languages/formats.
- **A component library (shadcn, Radix Themes, etc.) on top of Tailwind**: rejected for this
  phase (CLAUDE.md §16) — PokeLab's differentiators are Battle Lab/AI Coach/Replay
  Analyzer, not its button component; adding one now would import an aesthetic and a maintenance
  surface this phase doesn't need. Small local primitives (`apps/web/src/lib/ui-classes.ts`,
  `apps/web/src/components/ui/skeleton.tsx`) cover the handful of genuinely reused patterns
  (button, card, tag, eyebrow, skeleton) instead.

## Consequences

- New dev dependencies: `tailwindcss`, `@tailwindcss/postcss` (`apps/web`). Nothing removed —
  there was no prior styling library to retire.
- `apps/web/postcss.config.mjs` is the only new config file; Tailwind v4 needs no
  `tailwind.config.js`.
- 0 `.module.css` files remain anywhere in `apps/web`.
- Content scanning is implicit (Tailwind v4 auto-detects template files under the project
  root the build runs from). `packages/ui` currently ships no JSX/TSX, so nothing there needs
  scanning; if it ever gains React components, an explicit `@source` directive should be added
  to `tokens.css` at that point.
- Future contributors write `bg-surface`/`text-muted`/`rounded-lg`/etc., never a raw hex or an
  arbitrary pixel value, unless the value is genuinely one-off/structural (documented inline
  where used, e.g. the Pokédex grid's `auto-fill` track list).

## Revisit when

- `packages/ui` needs to ship actual React components (not just tokens/theme primitives) — at
  that point, decide whether it needs its own Tailwind content-scanning boundary or should stay
  markup-free.
- A second `apps/*` package needs the same token/Tailwind pairing — extract the `@theme` block
  (or the whole `postcss.config.mjs` pattern) into a shared config package rather than
  duplicating it.
