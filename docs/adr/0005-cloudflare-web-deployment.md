# ADR-0005: Cloudflare-oriented web deployment

- Status: Accepted
- Date: 2026-09-08

## Context

PokeLab should start cheap, fast and globally accessible. Cloudflare offers suitable web/edge deployment capabilities.

## Decision

Target a Cloudflare-compatible deployment path for the Next.js web application, following current supported official guidance at implementation time.

Do not bind core domain logic to Cloudflare-specific primitives without need.

## Consequences

- low initial cost and strong global delivery,
- framework integration must be validated against current Cloudflare recommendations,
- persistent battle workloads may use a separate runtime later.

## Phase 1B.2 addendum — concrete path chosen: `@opennextjs/cloudflare`

At implementation time, Cloudflare's stated default recommendation was **vinext** (an
experimental, Vite-based reimplementation of the Next.js API surface), with **`@opennextjs/cloudflare`**
(which adapts `next build`'s own output — the mature, long-established path) offered as the
fallback for projects vinext doesn't yet fit.

Both were evaluated against this actual repository, not just against their documentation:

- `npx vinext check` reported 83% compatibility (single fixable structural issue: this package
  needs `"type": "module"`). Actually running `npx vinext init` against this repo, however,
  surfaced two concrete problems no amount of reading the docs would have: (1) its generated
  `vite.config.ts` fails to typecheck under this repo's strict `exactOptionalPropertyTypes`
  TypeScript setting (`packages/config/tsconfig-base.json`) — a real `pnpm typecheck` failure, not
  a style nit; (2) unmet peer dependencies (`react-server-dom-webpack` wants `react`/`react-dom`
  `^19.3.0`, this repo has `19.2.8`; `vinext`/`@vitejs/plugin-react` want `vite@^8`, resolved to
  `5.4.21` before `vinext init` force-installed `8.2.2` alongside it). Combined with vinext's own
  explicit "experimental, use at your own risk" / "there will be bugs" / not-line-by-line-reviewed
  status, this was reverted rather than worked around.
- `@opennextjs/cloudflare` installed cleanly (no peer conflicts), built cleanly with a minimal
  config (no R2/KV incremental-cache override — this app has no ISR needing one yet), and its
  local preview (real `workerd` runtime via Wrangler, not just `next build`) correctly served
  locale middleware redirects, the paginated Supabase-backed Pokédex index, a 6-form detail page,
  ES regional-form names, `robots.txt`, and a 2054-URL dynamic `sitemap.xml`.

**Decision**: use `@opennextjs/cloudflare` now. Revisit vinext once it has matured past its
current experimental/unreviewed state and its peer-dependency requirements no longer conflict
with this repo's pinned versions — the two problems found are exactly the kind that resolve with
time, not architectural incompatibility with PokeLab's approach.
