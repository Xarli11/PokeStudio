# Changelog

All notable PokeStudio changes should be recorded here.

Use human-readable entries. Do not dump every commit.

## Unreleased

### Phase 1C.1 — Abilities and evolutions (2026-09-10)

Extends the Pokédex vertical slice with abilities and evolution relationships (ADR-0011) —
**313 abilities, 3369 form/ability links, 553 evolution edges** across the full 1025-species dataset.

- **Abilities schema**: `ability` (canonical — slug, English/Spanish name, English/Spanish effect
  where available, provenance) and `pokemon_form_ability` (join: which ability, which slot, hidden
  or not). One row per real ability, never duplicated per Pokémon — proved against Bulbasaur/Ivysaur/
  Venusaur all sharing one `overgrow` row. Public-read/service-write RLS, same pattern as
  `species`/`pokemon_form`.
- **Evolutions schema**: `species_evolution`, a graph of edges (`from_species_id -> to_species_id`
  plus condition) rather than fixed stage columns — required to represent Eevee's 8-way branch and
  Feebas' two independently valid evolution methods to the same target (max Beauty, or trade
  holding Prism Scale) without hacks. See ADR-0011 for the full rationale (including why the two
  join tables have no independent external identity and are replaced-per-run instead of upserted
  by identity).
- **Ingestion extended, not re-architected**: two new bounded-concurrency fetch phases (unique
  ability URLs, unique evolution-chain URLs — each fetched once regardless of how many
  species/varieties reference it), normalized alongside species/forms, validated (new invariants:
  ability slug/external-id collisions, orphan form/ability and evolution references, self-
  referencing edges), persisted idempotently. A warm-cache full re-run touches the network 0 times
  and reproduces byte-identical row counts.
- **Real data-quality findings** (`pnpm --filter @pokestudio/pokemon-data audit`, DATA_SOURCES.md):
  PokéAPI provides a Spanish ability name for all but 3 of 313 abilities, but a Spanish ability
  _effect_ for **none** of them — every `effect_es` is null, never invented. Evolution
  `evolution_details` also isn't version-group-scoped in this model: some evolutions (Magneton ->
  Magnezone, Eevee -> Leafeon) list the same conceptual "level up in a special location" method
  once per game's location, surfacing as several near-duplicate edges rather than one — the UI
  collapses these for display (edges rendering to an identical description string are deduplicated;
  see `apps/web/src/lib/evolution-condition.ts`) without losing the underlying rows.
- **Explore UI**: each form's card now lists its abilities (hidden ability visually distinguished,
  localized name, concise effect where available, "no description available" rather than a blank
  or an invented one). A new evolution section renders the species' full family as simple
  `[from] → [to] (condition)` rows — supports branching and multiple alternative conditions per
  edge, links every species to its own detail page, no diagramming dependency.
- **Query layer** (`packages/database/src/queries.ts`): `getSpeciesBySlug` now includes each form's
  abilities; new `getEvolutionFamily` resolves a species' whole family via two small indexed
  queries (find any edge touching the species to learn its PokéAPI evolution-chain id, then fetch
  every edge sharing it) rather than a recursive SQL walk or a full-table scan.
- New migrations: `20260910120000_pokemon_abilities.sql`, `20260910130000_pokemon_evolutions.sql`.
  `generated-database-types.ts` regenerated.

### Phase 1B.2 — Cloudflare Workers readiness (2026-09-09)

Prepared `apps/web` to deploy to Cloudflare Workers (ADR-0005) — not deployed yet.

- Evaluated Cloudflare's two current Next.js deployment paths against this actual repo: **vinext**
  (Cloudflare's stated default, but explicitly experimental/AI-built/unreviewed) was tried via
  `npx vinext init` and reverted after it broke `pnpm typecheck` (its generated `vite.config.ts`
  fails under this repo's strict `exactOptionalPropertyTypes`) and showed unmet peer dependencies
  (React 19.2.8 vs. required ^19.3.0). **`@opennextjs/cloudflare`** (the mature, `next build`-adapting
  path) installed and built cleanly with zero peer conflicts and no extra infrastructure — chosen
  instead. Full evaluation in ADR-0005's Phase 1B.2 addendum.
- Added minimal Cloudflare config: `apps/web/wrangler.jsonc` (nodejs_compat, static assets, no
  R2/KV cache, no images binding — none needed yet) and `apps/web/open-next.config.ts` (default,
  no incremental-cache override).
- `apps/web/next.config.mjs` now also calls `initOpenNextCloudflareForDev()`, which makes plain
  `next dev` Cloudflare-binding-aware. `pnpm dev`/`pnpm build` are otherwise unchanged — verified
  both still work exactly as before.
- New scripts (root and `apps/web`): `build:cf`, `preview:cf`, `deploy:cf`.
- Verified end-to-end on the real `workerd` runtime (`preview:cf`, not just `next build`): locale
  middleware redirects, the paginated Supabase-backed Pokédex index, a 6-form Rotom detail page,
  ES regional-form names, `robots.txt`, and a 2054-URL dynamic `sitemap.xml` all served correctly.
- The deployed Worker needs `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` as
  Worker environment variables (never committed) — `SUPABASE_SECRET_KEY` must never be configured
  on it. No deployment performed; no domain connected; no production config added.

### Phase 1B — Full Pokédex ingestion and dataset hardening (2026-09-09)

Replaces the Phase 1A hand-mirrored 3-species sample with a reproducible, idempotent, full-dataset
ingestion pipeline: **1025 species, 1579 forms** — the complete PokéAPI dataset for this scope.

- **`seed.sql` retired as the Pokémon-data mechanism** (DATABASE.md "Seed vs. ingestion"):
  `species`/`pokemon_form`/`data_sources` now come exclusively from
  `pnpm --filter @pokestudio/pokemon-data ingest`. `db:reset` applies schema only.
- **General ingestion pipeline** (`packages/pokemon-data`): fetch (bounded concurrency, on-disk
  cache keyed by URL, three flat phases — species → varieties → forms) → normalize (pure,
  fixture-tested) → validate (expanded invariants: type/category validity, external-identity
  collisions, orphan forms) → persist (batched, identity-based upsert). No hand-declared manifest
  — the full species list comes from PokéAPI's own listing endpoint.
- **Idempotent, identity-based persistence**: species/forms matched by `(source_id, external_id)`
  — new unique constraints added via migration — never by slug; an existing row's slug is
  preserved verbatim on every re-sync. Verified: two full runs against a freshly reset database
  produced byte-identical row counts (1025/1579) with unchanged row ids/`created_at` timestamps.
- **Form classification hardened against real edge cases** the small sample couldn't exercise
  (`packages/pokemon-data/src/classify.ts`): fixed two genuine bugs found via full-dataset
  auditing — Rotom-style forms that change type but carry no PokéAPI battle-only/mega flag (now
  classified `battle` by comparing against the species' default-variety types/stats, not just
  those flags) and Xerneas' two-state default form (neither `xerneas-active` nor
  `xerneas-neutral` matches the species name; PokéAPI's per-form `is_default` is unreliable when
  every form claims it, but correctly disambiguates when exactly one does). Both fixes are
  general rules, not per-Pokémon patches.
- **Classification/localization audit report** (`pnpm --filter @pokestudio/pokemon-data audit`):
  species/form counts, category distribution (1025 default / 220 battle / 54 regional / 280
  cosmetic), largest form families (Alcremie 64, Unown 28, Vivillon/Scatterbug/Spewpa 20 each),
  and a localization breakdown distinguishing genuine PokéAPI-provided Spanish names (273) from
  correct-by-design regional composition (54) from a real upstream data gap requiring a
  descriptor-based fallback (227, e.g. "Charizard (gmax)") — never manually translated in this
  phase, per instruction.
- **Generated Supabase types are now authoritative** (`packages/database/src/generated-database-types.ts`),
  replacing the Phase 0/1A hand-maintained subset that had already caused real `never`-inference
  bugs from small omissions.
- **Fixed a real scale bug found during the first full ingestion run**: PostgREST's default
  1000-row response cap silently truncated identity-resolution reads once the dataset exceeded it
  — both the ingestion write path and `listSpecies` now paginate past it.
- **Pokédex index now paginates** (`listSpeciesPage`, page-number navigation, no client JS/search):
  the full 1025-species index was a ~6MB response; page-size-60 responses are ~400KB.
- Expanded test coverage: classification edge cases (Rotom/Xerneas/Vivillon/Charizard-mega),
  expanded validation invariants, a persistence idempotency integration test, and full-dataset
  query integration tests (Alcremie/Xerneas/Rotom/Meowth) replacing the Phase 1A 3-species-only
  assertions.

### Phase 1A — Explore Core vertical slice (2026-09-09)

First real product feature: proves source → normalization → PostgreSQL/Supabase
→ typed data access → Pokédex index → detail page end-to-end, for a
deliberately small, structurally challenging sample.

- **Normalized species/form schema** (`supabase/migrations/20260909150000_pokemon_species_forms.sql`,
  ADR-0010): `species` (canonical identity — slug, dex number, localized
  name) and `pokemon_form` (default/regional/battle/cosmetic — types and base
  stats live here, since they differ _by form_) replace the Phase 0 flattened
  `species` spike table. PokeStudio's own `slug` is the primary identity;
  PokéAPI's id is recorded only as provenance (`source_id`/`external_id`),
  never used to look records up. Public-read/service-write RLS, same pattern
  as `data_sources`.
- **Real ingestion path** (`packages/pokemon-data`): `pokeapi-client.ts`
  (typed fetch) → `normalize.ts` (pure, unit-tested against fixture JSON, no
  network) → `validate.ts` → `scripts/ingest-explore.ts`, run against the
  live PokéAPI for Bulbasaur, Rotom (+ its 5 appliance forms: Heat/Wash/
  Frost/Fan/Mow) and Meowth (+ Alolan/Galarian regional forms). Output
  mirrored into `packages/database/supabase/seed.sql` for reproducible local
  dev. Found and worked around a real PokéAPI data-quality gap: non-default
  forms' Spanish full names are frequently missing (see DATA_SOURCES.md
  "Localized form names").
- **Domain-shaped data access** (`packages/database/src/queries.ts`):
  `listSpecies`/`getSpeciesBySlug`, returning PokeStudio-shaped results, not
  raw rows. Proved against the real seeded data — Rotom returns as one
  species with 6 related forms sharing base stats but differing types;
  Meowth's regional forms return with their own (different) types _and_ base
  stats, confirming why that data has to live on the form, not the species.
- **Pokédex routes**: `/[locale]/pokemon` (index) and `/[locale]/pokemon/[slug]`
  (detail, forms shown together with in-page jump links — no client-side
  form-switching component needed for 1-6 forms). Server-rendered per request
  (`export const dynamic = 'force-dynamic'`) — verified `next build` never
  touches the database (no local Supabase instance was running during that
  verification build, and neither route appears in the static prerender
  manifest afterward), so CI's build job needs no live Supabase instance.
  Localized title/description/canonical/hreflang/Open Graph per page;
  `sitemap.ts` now lists both routes for both locales (best-effort — falls
  back to locale-only entries rather than 500ing if the database is briefly
  unreachable).
- **No Pokémon sprite/artwork introduced.** A neutral, type-accented
  placeholder stands in for visuals pending a reviewed, license-cleared asset
  source (DATA_SOURCES.md "Phase 1A decision: no sprite/artwork source yet").
- Extended `packages/ui`'s Pokémon type-color tokens from 6 to the full
  18-type set (`--ps-type-*`), needed for this phase's real type data.
- Added a minimal `formatMessage(template, vars)` `{placeholder}` helper to
  `packages/i18n` for the handful of dictionary strings that need a value —
  the small-interpolation-helper path ADR-0009 anticipated, not a message-format
  library.

### Phase 0.5 — Foundation hardening (2026-09-09)

- **Node runtime pinned to 24 LTS** (`.nvmrc`, `package.json#engines`). Confirmed the
  `better-sqlite3` (transitive, via `pokemon-showdown`) install-time warning is caused by Node's
  current odd-numbered release having no prebuilt native binary for that dependency, forcing a
  from-source compile; Node 24 LTS has prebuilt binaries and avoids it (see DEPENDENCY_POLICY.md).
  CI already read `.nvmrc` via `node-version-file`, so no separate CI change was needed.
- **Fixed a real bug in the local Supabase workflow**: `db:start`/`db:stop`/`db:reset`/`db:diff`
  (`packages/database/package.json`) passed `--workdir supabase` while already running with
  `packages/database` as their cwd. That pointed the CLI at a second, nonexistent `supabase/`
  level, so it silently skipped the real `migrations/` and `seed.sql` and stood up an empty
  database under a stray `supabase/supabase/` directory — `db:start` reported success while the
  `species` table never existed. Verified against the real Supabase local stack (Postgres 17,
  GoTrue, PostgREST, Storage, Realtime, Studio) run via Docker: with the flag removed, `db:start`/
  `db:reset` correctly apply the committed migration and seed from a clean state, `supabase gen
types typescript --local` matches the hand-maintained `src/types.ts` subset, and the RLS
  integration suite (`packages/database/tests/rls.integration.test.ts`) passes for real against
  the running instance (anon reads succeed, anon writes are rejected, service-role writes
  succeed). Confirms the "fresh clone recreates the full dev database from committed files"
  invariant, previously only checked against a standalone Postgres fallback.
- **i18n architecture review (ADR-0009)**: compared the custom `packages/i18n` dictionary against
  `next-intl`. Kept the custom implementation — it already covers Phase 0/1 requirements (typed
  keys, App Router routing, metadata/hreflang/sitemap) in ~90 lines with no dependency; `next-intl`
  would add a config surface without measurably reducing complexity for PokeStudio's current needs.
- **Battle engine boundary hardened**: removed `parseProtocolLine` from `packages/battle-engine`'s
  public `index.ts` — it took a raw Showdown protocol-line string, which was the one place the
  public API implicitly asked callers to understand Showdown's wire format. It remains available
  internally to `adapter.ts`. No other Showdown/`@smogon/calc` internals leak outside their adapter
  packages (verified by repo-wide import search).
- **Damage engine regression coverage added**: STAB, super-effective vs. resisted ordering, and one
  fully-pinned known-good matchup (`packages/damage/src/index.test.ts`) — previously only a single
  representative case plus an immunity case existed.
- **Pokémon data normalization strategy documented (ADR-0010)** ahead of Phase 1 ingestion:
  species/form/regional-form/battle-only-form/cosmetic-form separation, generation-scoped
  types/stats, and game/format availability as an explicit join — implemented incrementally, not
  built speculatively.
- Repo hygiene: `.gitignore` now covers `research/python/.mypy_cache/`, `.ruff_cache/` and
  `*.egg-info/` (previously only `.pytest_cache/`/`__pycache__/`/`.venv/` were covered); added a
  root `README.md` "Development setup" section (Node/pnpm versions, install, web/Supabase/checks/
  Python commands) for new contributors.

### Added

- Initial PokeStudio product/architecture specification pack.
- Explore / Build / Battle Lab product model.
- PokeStudio AI grounding principles.
- Initial Supabase, Cloudflare, GitHub and Sentry architecture direction.
- Pokémon Showdown and `@smogon/calc` adapter strategy.
- Python research/AI lane.
- Source-available licensing strategy draft.
- Initial ADR set.

### Phase 0 — Foundation (2026-09-08)

- pnpm + Turborepo monorepo (`apps/web`, `packages/*`, `research/python`), strict
  TypeScript, ESLint 9 flat config, Prettier, GitHub Actions CI.
- Next.js App Router web foundation: `/en` and `/es` locales with a small
  hand-rolled i18n boundary (`packages/i18n`), dark-first/light-supported theme
  tokens with no flash-of-wrong-theme (`packages/ui`), SEO primitives
  (sitemap/robots/hreflang), a console-based observability boundary that swaps
  in for Sentry once a DSN exists.
- `packages/database`: Supabase-oriented PostgreSQL boundary. One migration
  (`data_sources` provenance table + a `species` reference table) with public-read
  / service-write RLS, verified end-to-end against a local Postgres instance
  (anon can read, anon/authenticated writes are rejected by RLS even with full
  table grants). Typed client factory; RLS integration test suite included and
  skips cleanly when no local Supabase instance is running.
- `packages/pokemon-data`: normalized species schema, dataset validator, and an
  ingestion spike that fetches 3 species from PokéAPI (BSD-3-Clause) and writes
  a provenance-tagged JSON artifact — proves the pipeline shape without being a
  runtime dependency.
- `packages/battle-engine`: adapter spike around `pokemon-showdown@0.11.11`'s
  simulator (ADR-0003). Runs a full headless battle deterministically for a
  fixed seed + fixed teams and emits a structured event trace; no upstream
  protocol strings leak past the adapter boundary.
- `packages/damage`: adapter spike around `@smogon/calc@0.11.0` (ADR-0004).
  Returns a PokeStudio-shaped damage range/description/KO-chance, handling
  zero-damage matchups (immunities) without crashing.
- `research/python`: Python research lane (ADR-0007) with a first statistical
  spike (damage-roll summary) and ruff/mypy/pytest gates.
- License status stub (`LICENSE`) pointing at `LICENSING_STRATEGY.md`/ADR-0008
  pending legal review. `THIRD_PARTY_NOTICES.md` updated with exact dependency
  versions and the PokéAPI data license.
