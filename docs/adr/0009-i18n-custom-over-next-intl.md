# ADR-0009: Keep the custom `packages/i18n` dictionary instead of adopting `next-intl`

- Status: Accepted
- Date: 2026-09-09

## Context

Phase 0 shipped a hand-rolled i18n skeleton: `packages/i18n` exports a `Locale` union (`en`/`es`),
a `getDictionary(locale)` lookup typed off the English JSON dictionary (`Dictionary = typeof en`),
and `apps/web` wires it into App Router `[locale]` segments, middleware-based cookie/
`Accept-Language` detection, `generateStaticParams`, `generateMetadata` (with `alternates.languages`
hreflang), `sitemap.ts` and a client `LocaleSwitcher`. Total surface is ~90 lines plus two small
JSON dictionaries.

Phase 0.5 asks whether this should be replaced by `next-intl`, a mature, widely used Next.js i18n
library, before the cost of migrating grows.

`next-intl` would add: ICU message format (plurals, rich formatting), `useTranslations`/
`useFormatter` hooks, locale-aware `Link`/`redirect` helpers, a `next.config` plugin, a
`request.ts` config module, and its own routing middleware — at the cost of a new dependency,
its own upgrade cadence, and a config surface (routing config, message loading, middleware
wrapping) to learn and maintain.

## Decision

Keep the custom `packages/i18n` dictionary. Do not adopt `next-intl` at this time.

Rationale, evaluated against actual PokeStudio requirements (not hypothetical future ones):

- **Locales, routing, Server/Client Components, metadata, sitemap/hreflang**: already fully
  covered by the current App Router `[locale]` + middleware + `generateMetadata` implementation,
  which uses only native Next.js primitives — nothing `next-intl` provides here is unavailable.
- **Typed translation keys**: already solved for free — `Dictionary = typeof en` gives full
  autocomplete and compile-time key checking without a codegen step or a library.
- **ICU plurals / number-and-date formatting**: not a current requirement. PokeStudio's Phase 0/1
  copy is short, static UI strings (nav labels, page titles, a disclaimer) with no plural or
  interpolated-number cases yet. `Intl.NumberFormat`/`Intl.DateTimeFormat` (native, zero-dependency)
  cover formatting needs if/when they arise, independent of whichever dictionary lookup is used.
- **Additional future languages**: adding a language today means adding one entry to `locales` and
  one JSON file — the same cost under either approach.
- **Testing / maintenance burden**: the current implementation is fully covered by
  `packages/i18n/src/index.test.ts` and has no upstream to track. `next-intl` is well-maintained,
  but its major-version cadence and Next.js-canary-coupling (App Router support has moved fast) is
  a real, non-zero maintenance cost that buys nothing PokeStudio needs yet.

Per Ponytail (CLAUDE.md §3): _owning less code is preferable when a mature dependency solves a real
recurring problem more simply_ — but _do not adopt a dependency unless it measurably reduces
complexity_. `next-intl` does not measurably reduce complexity here; it would net-add a config
surface around a problem the current ~90-line implementation already solves correctly and typed.

## Known gaps to track, not fix now

- No locale-aware `not-found.tsx` under `app/[locale]/` yet (only the global `global-error.tsx`
  boundary exists) — `notFound()` calls currently fall through to the framework default. Worth a
  small Phase 1 pass once there are real localized 404 copy needs.
- No ICU-style interpolation/pluralization exists yet. If Phase 1+ copy needs plurals or
  interpolated variables, re-evaluate: a small `formatMessage(template, vars)` helper is likely
  still simpler than adopting `next-intl` for that alone, but revisit if the number of such strings
  grows large.

## Revisit when

- A third locale with materially different pluralization rules is added, or
- Rich message interpolation/pluralization becomes common across the product (not a single string),
  or
- Server-rendered locale-aware `Link`/routing helpers become genuinely error-prone to hand-roll.

## Consequences

- No new dependency; the i18n surface stays inside PokeStudio's own boundary.
- Future contributors must extend `packages/i18n` by hand for formatting/pluralization needs until
  one of the "Revisit when" triggers above is hit.
