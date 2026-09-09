# PokeStudio — Architecture v1

## Architectural style

Start as a **modular monorepo**, not microservices.

Keep domain boundaries clear enough that high-load components can be separated later if evidence justifies it.

## Initial stack

- TypeScript
- React
- Next.js
- pnpm workspaces + Turborepo (task orchestration/caching), chosen in Phase 0
- PostgreSQL
- Supabase as initial managed Postgres/Auth/Storage platform
- Cloudflare-oriented web deployment
- Node/TypeScript battle runtime when persistent battle transport is required
- Python for research/simulation/AI experimentation, not necessarily production runtime
- GitHub Actions
- Sentry

Avoid unnecessary provider-specific coupling in core business logic.

## Suggested repository shape

Create only boundaries needed by real code.

```text
apps/
  web/
  battle-server/        # create when persistent multiplayer/AI runtime needs it

packages/
  ui/
  domain/
  database/
  pokemon-data/
  battle-engine/
  damage/
  formats/
  team-builder/
  ai/
  i18n/
  config/

research/
  python/               # experiments, evaluation, simulation notebooks/scripts

docs/
  adr/
```

This is a target shape, not a command to create every directory on day one.

### Phase 0 actual shape

Created because Phase 0 had real code for them: `apps/web`, `packages/config`,
`packages/ui` (tokens/theme only), `packages/i18n`, `packages/database`,
`packages/pokemon-data`, `packages/battle-engine`, `packages/damage`,
`research/python`.

Deferred (no Phase 0 responsibility yet): `apps/battle-server`, `packages/domain`,
`packages/formats`, `packages/team-builder`, `packages/ai`. Interfaces that
would eventually live in `packages/domain` (e.g. the conceptual `BattleEngine`
API in BATTLE_ENGINE.md) currently live as each adapter package's own public
API surface until a second consumer justifies extracting a shared package.

### Phase 1A addition — Explore Core vertical slice

The first real product feature (ROADMAP.md Phase 1, ADR-0010): a Pokédex index
(`/[locale]/pokemon`) and detail page (`/[locale]/pokemon/[slug]`) reading
normalized species/form reference data end-to-end from Postgres.

- `packages/pokemon-data` gained a real (non-spike) ingestion path:
  `pokeapi-client.ts` (typed fetch, no normalization) → `normalize.ts` (pure,
  fixture-testable) → `validate.ts` → `scripts/ingest-explore.ts`, which
  writes a provenance-tagged JSON artifact that `packages/database/supabase/seed.sql`
  mirrors, the same "offline ingestion, not a runtime dependency" shape as
  Phase 0 (CLAUDE.md §10).
- `packages/database` gained domain-shaped read queries (`listSpecies`,
  `getSpeciesBySlug` in `src/queries.ts`) on top of the existing typed
  connection adapter — apps/web calls these, never raw `species`/`pokemon_form`
  table queries, per CLAUDE.md §3 (no repository/service layer, but UI must
  not query arbitrary tables directly either).
- `apps/web` reads this data server-side only: a small `getPokemonDatabaseClient()`
  helper (`src/lib/pokemon-database.ts`) builds a public (anon-key, RLS-governed)
  Supabase client, used only from Server Components. Both Pokédex routes and
  `sitemap.ts` are marked `export const dynamic = 'force-dynamic'` so `next build`
  never attempts to reach a database at build time (CI's Node job runs without
  a live Supabase instance) — verified by building with Supabase stopped and
  confirming neither route appears in the static prerender manifest.

## Layering

### UI

React components and route composition.

Must not encode battle formulas, legality rules or database-specific behavior.

### Application/domain

PokeStudio use cases and domain interfaces.

Examples:

- search Pokémon,
- validate team,
- create team,
- calculate matchup,
- start battle,
- analyze replay.

### Infrastructure adapters

Examples:

- Supabase identity/storage adapter,
- PostgreSQL repositories/query layer,
- Showdown simulator adapter,
- Smogon calc adapter,
- Sentry integration,
- AI provider adapters.

## Battle architecture

Battle state authority must live server-side for online battles.

Conceptually:

```text
Client A ─┐
          ├─ WebSocket/transport ─ Battle Server ─ PokeStudio Battle API ─ Showdown adapter
Client B ─┘
```

Do not make Supabase Realtime authoritative for battle simulation.

Battle domain should be transport-independent.

## AI architecture

```text
User intent/context
      ↓
PokeStudio AI orchestration
      ├─ normalized data queries
      ├─ format/legal validation
      ├─ damage engine
      ├─ battle engine / replay data
      ├─ meta statistics
      └─ LLM provider adapter
```

LLM output is not accepted as factual authority without deterministic validation where applicable.

## Data architecture

```text
External sources
   ↓
ingestion
   ↓
normalization
   ↓
validation
   ↓
versioning/provenance
   ↓
PokeStudio PostgreSQL / generated artifacts
   ↓
application APIs/pages
```

The app must not depend on real-time PokéAPI calls for normal page rendering.

## Deployment evolution

### Phase 0/early beta

- Web: Cloudflare-compatible Next.js deployment path.
- DB/Auth: Supabase.
- Battle engine: local/in-process spike until persistent transport is needed.
- CI: GitHub Actions.
- Error tracking: Sentry.

### Later

A small VPS or suitable persistent runtime can host battle services when WebSockets/continuous sessions justify it.

Only separate services after profiling/operational evidence.

## Portability rules

- PostgreSQL schema/migrations live in the repo.
- Domain code cannot assume Supabase-specific table semantics everywhere.
- Auth uses a PokeStudio identity abstraction.
- Storage uses a boundary where appropriate.
- AI providers use adapters.
- Battle simulator uses a PokeStudio boundary.

## Phase 0.5 confirmations

Foundation-hardening review (2026-09-09, see `CHANGELOG.md`) confirmed or adjusted the following
Phase 0 decisions while changes were still inexpensive:

- **Turborepo/pnpm workspaces**: confirmed, no change.
- **Node runtime**: pinned to 24 LTS (`.nvmrc`, `package.json#engines`) rather than an open-ended
  `>=20.0.0` range — avoids Node's current odd-numbered "latest" release, which lacks a prebuilt
  `better-sqlite3` binary (transitive via `pokemon-showdown`) and silently falls back to a
  from-source compile. See DEPENDENCY_POLICY.md.
- **i18n**: confirmed the custom `packages/i18n` dictionary over adopting `next-intl` (ADR-0009).
- **Supabase local workflow**: verified against the real local stack (Postgres/GoTrue/PostgREST/
  Storage/Realtime/Studio via Docker), not just a standalone Postgres fallback. Found and fixed a
  workflow bug where `db:start`/`db:reset` were silently skipping migrations and seed data.
- **Battle engine boundary** (`packages/battle-engine`, ADR-0003): confirmed no
  `pokemon-showdown` internals leak outside the adapter package; tightened the public API by
  removing a re-export (`parseProtocolLine`) that took a raw Showdown protocol-line string.
- **Damage engine boundary** (`packages/damage`, ADR-0004): confirmed no `@smogon/calc` internals
  leak outside the adapter package; added STAB/super-effective/resisted/pinned-scenario regression
  coverage.
- **Python research lane** (ADR-0007): confirmed, no change; ruff/mypy/pytest all pass.
- **Pokémon data normalization**: documented the Phase 1 strategy (species/form/generation-scoped
  data/game-availability) before real ingestion begins (ADR-0010), so the Phase 0 flattened
  `species` spike table is not mistaken for the target schema.

## Architecture quality attributes

Prioritize:

1. correctness,
2. maintainability,
3. performance,
4. low operating cost,
5. portability,
6. developer ergonomics,
7. scale when justified.
