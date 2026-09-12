# PokeStudio — Strategic Dependency Policy

## Principle

External does not mean untouchable, and internal does not mean better.

> Reuse commodities. Own differentiation. Improve dependencies when doing so creates real value.

## Strategic dependency checklist

For any dependency central to product behavior, document:

1. why we use it,
2. license,
3. exact boundary/package used,
4. PokeStudio adapter/boundary,
5. version/update strategy,
6. compatibility tests,
7. exit/fork strategy,
8. attribution/notices.

## Decision ladder

### 1. Use upstream directly behind our boundary

When it already solves the problem correctly.

### 2. Extend above upstream

When the requirement is PokeStudio-specific.

Example: structured replay analysis around a battle engine.

### 3. Contribute upstream

When an improvement is generic and likely useful to the upstream project.

### 4. Minimal maintained fork

Only when a strategically important capability is blocked and extension/upstream contribution is impractical.

Requires ADR.

## Initial strategic dependencies

### Pokémon Showdown server/simulator

Reason: mature battle mechanics and formats foundation.

License: MIT for server/simulator repository; verify exact dependency boundary at integration time.

PokeStudio must not couple UI directly to internals — enforced by `packages/battle-engine`
(ADR-0003); only that package imports `pokemon-showdown` (verified in Phase 0.5, no exceptions).

`pokemon-showdown` depends on `better-sqlite3` (a native module) for its own server-side chat/
modlog/friends/private-messages features, none of which PokeStudio uses (PokeStudio only drives
`BattleStream`/`Teams` from `sim/`). `better-sqlite3` has no prebuilt binary for Node's current
odd-numbered "latest" release, forcing a from-source `node-gyp` compile with a warning at install
time; Node 24 LTS (the pinned runtime, see `.nvmrc`) has prebuilt binaries and avoids this. Do not
add a workaround (patching it out, stubbing the native module, etc.) for functionality PokeStudio
does not use — pinning the runtime is the correct fix.

### `@smogon/calc`

Reason: mature multi-generation damage formulas and programmatic API.

License: MIT.

Use through PokeStudio damage boundary.

### Supabase

Reason: managed PostgreSQL + Auth + Storage/Realtimes capabilities available when needed.

Boundary: PostgreSQL-first schema, PokeStudio identity/storage abstractions where useful.
`@supabase/supabase-js` is a direct dependency of both `packages/database` (the shared connection
adapter, `PokeStudioDatabaseClient`) and `packages/pokemon-data` (Phase 1B's ingestion write path,
`IngestClient`) — the two packages otherwise cannot depend on each other without a circular
workspace dependency (`database` already depends on `pokemon-data` for shared domain types), so
`pokemon-data` talks to Postgres via `@supabase/supabase-js` directly with its own minimal,
locally-declared schema type (`packages/pokemon-data/src/persist.ts`) rather than importing
`packages/database`'s `Database` type.

### Cloudflare

Reason: low-cost scalable web deployment/CDN/edge capabilities.

Boundary: do not embed domain semantics into Cloudflare-only primitives without reason.
`@opennextjs/cloudflare` (Apache-2.0) is the concrete adapter (ADR-0005) — it adapts `next build`'s
own output into a Worker; `apps/web`'s application code has no Cloudflare-specific imports.
`wrangler` (MPL-2.0) is the CLI/dev-tool used to build/preview/deploy, not a runtime dependency of
the app itself. Evaluated and deliberately not adopted (yet): `vinext` — experimental, unreviewed,
had real peer-dependency and strict-TypeScript-config friction with this repo at evaluation time
(ADR-0005 addendum); revisit once it matures.

### Sentry

Reason: production error/performance visibility.

Boundary: telemetry adapter/config; no business logic dependency.

## Dependency update policy

- avoid blind automated major upgrades,
- read release notes for strategic dependencies,
- run compatibility/regression suites,
- record material upgrades in changelog,
- preserve license notices.
