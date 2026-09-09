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

### Cloudflare

Reason: low-cost scalable web deployment/CDN/edge capabilities.

Boundary: do not embed domain semantics into Cloudflare-only primitives without reason.

### Sentry

Reason: production error/performance visibility.

Boundary: telemetry adapter/config; no business logic dependency.

## Dependency update policy

- avoid blind automated major upgrades,
- read release notes for strategic dependencies,
- run compatibility/regression suites,
- record material upgrades in changelog,
- preserve license notices.
