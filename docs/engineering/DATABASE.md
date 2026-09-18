# PokeLab — Database Strategy

## Decision

Initial managed database/auth platform: **Supabase**, using PostgreSQL as the durable data model.

PokeLab must remain PostgreSQL-centric rather than spreading Supabase-specific assumptions throughout domain code.

## Raspberry Pi local development

Normal PokeLab development runs the web app on the Mac but talks to a self-hosted Supabase
instance on a Raspberry Pi over the LAN. That Pi is the canonical local-development database —
**not** a Supabase stack started on the Mac (CLAUDE.md §21 "Local Development Database"). The
deployed Cloudflare Worker DEV environment is a separate, unrelated target:

```text
LOCAL DEVELOPMENT

Mac
├── Next.js localhost:3000
│
└── LAN
    └── Raspberry Pi 192.168.1.236 (/home/xarli11/supabase-pokestudio, Docker Compose)
        ├── Supabase API Gateway :8002   ← app/runtime reads, ingestion pipeline
        ├── PostgreSQL :5434              ← migrations, DB admin (db:pi:migrate, db:pi:check)
        └── Supavisor :5433 / :6543       ← exists, not the preferred migration path

DEPLOYED DEV

Cloudflare Worker
└── Supabase Cloud "PokeStudio Dev"
```

- **App/runtime access** (`apps/web`, `NEXT_PUBLIC_SUPABASE_URL`) and the **ingestion pipeline**
  (`SUPABASE_URL`) go through the API gateway on `:8002`.
- **Migrations and direct DB administration** (`POKELAB_PI_DB_URL`) use PostgreSQL on `:5434`
  directly — this is what `pnpm db:pi:check`/`db:pi:migrate`/`db:pi:types` target.
- Supavisor (`:5433`/`:6543`, connection pooling) is reachable on the Pi but is not used by any
  current PokeLab tooling; direct Postgres is simpler for a single-developer local-dev target.
- `supabase start` on the Mac is **not** part of normal PokeLab development — the Pi's stack is
  Docker-Compose-managed directly (`setup.sh`/`run.sh` on the Pi), not `supabase`-CLI-managed. A
  Mac-local Supabase CLI stack remains available only as an isolated test environment
  (`packages/database/README.md` "Isolated local Supabase (exceptional)") — never the default.
- The Cloudflare Worker DEV deployment must keep using Supabase Cloud; never point it at the Pi's
  LAN address (unreachable from Cloudflare's network regardless).

Commands (root `package.json`, `scripts/db-pi-*.sh`/`dev-pi.sh`/`ingest-pi.sh`):

| Command              | Target                        | Guards against                            |
| -------------------- | ----------------------------- | ----------------------------------------- |
| `pnpm dev:pi`        | `NEXT_PUBLIC_SUPABASE_URL`    | a leftover localhost URL                  |
| `pnpm db:pi:check`   | `POKELAB_PI_DB_URL` (`:5434`) | wrong host/port/database; read-only       |
| `pnpm db:pi:migrate` | `POKELAB_PI_DB_URL` (`:5434`) | wrong host/port/database, before applying |
| `pnpm db:pi:types`   | `POKELAB_PI_DB_URL` (`:5434`) | wrong host/port/database                  |
| `pnpm ingest:pi`     | `SUPABASE_URL` (`:8002`)      | localhost or Supabase Cloud               |

Each guard aborts with a clear error (never printing the connection string/key) if the target
doesn't match `192.168.1.236` on the expected port — see `scripts/db-pi-guard.sh`.

### Deployed DEV deploy order (incident 2026-09-14)

On 2026-09-14 the deployed Worker started failing Pokémon/move detail pages with `Could not find
the table 'public.pokemon_form_move' in the schema cache`: Phase 1C.2's move-mechanics code
(`6de8f5f`) reached the deployed Worker via Cloudflare's git integration before Supabase Cloud
PokeStudio Dev had the matching migrations/data — the Pi had already been migrated/ingested, Cloud
DEV had not. HTTP status stayed `200` throughout (Next.js renders the error boundary, not a 5xx),
so the failure was only visible in the React Server Components payload (`"digest":"<id>"`) or
`wrangler tail` — a plain status check would have missed it entirely.

Deploying web code that depends on new Cloud DEV schema/data must follow this order, never skip a
step, and use the equivalent parallel command set (`scripts/db-cloud-dev-*.sh`/`ingest-cloud-dev.sh`,
mirroring the Pi's guard pattern but targeting Supabase Cloud PokeStudio Dev, project ref
`tofhupgwxsexrburoqys`, via `SUPABASE_CLOUD_DEV_DB_URL`/`SUPABASE_CLOUD_DEV_SECRET_KEY` — see
`.env.example`):

1. `pnpm db:cloud-dev:check` — confirm target + list pending migrations (read-only).
2. `pnpm db:cloud-dev:migrate` — apply only what's pending.
3. `pnpm ingest:cloud-dev` — only when reference data actually changed.
4. deploy the Worker (push to `main`; Cloudflare's git integration builds/deploys it).
5. `pnpm smoke:cloud-dev` — hits the deployed Worker's critical routes and fails on either a
   non-success HTTP status **or** an RSC error digest in the response body (`scripts/smoke-cloud-dev.sh`)
   — this is the check that would have caught the incident immediately.

Never reorder step 4 ahead of 1–3 for a change that requires new Cloud DEV schema/data.

## Principles

- migrations live in source control,
- local development is reproducible,
- RLS protects exposed user-owned data,
- private-by-default user resources,
- structured Pokémon reference data is separate from user-generated/synced data,
- provenance/versioning exists for imported datasets,
- do not design tables for hypothetical features years away.

## Implementation status (Phase 1C.1)

`species` and `pokemon_form` are implemented (`supabase/migrations/20260909150000_pokemon_species_forms.sql`,
`20260909160000_pokemon_identity_upsert_constraints.sql`), superseding the Phase 0 flattened
`species` spike table. Species (canonical identity: slug, dex number, localized name) and forms
(default/regional/battle/cosmetic — types and base stats live here, since they can differ by form)
are separate tables, per ADR-0010. Reference data is public-read (`anon`/`authenticated`) via RLS
policy; writes are service-role only, same pattern as `data_sources`. Fully populated: the complete
PokéAPI species/form dataset (~1025 species, ~1580 forms) via `pnpm --filter @pokelab/pokemon-data
ingest`, not a hand-picked sample.

**Abilities and evolutions** (Phase 1C.1, ADR-0011) are implemented too:
`supabase/migrations/20260910120000_pokemon_abilities.sql` adds `ability` (canonical — one row per
real ability, never duplicated per Pokémon) and `pokemon_form_ability` (join: which ability, which
slot, hidden or not); `supabase/migrations/20260910130000_pokemon_evolutions.sql` adds
`species_evolution`, a graph of edges between species rather than fixed stage columns — required to
represent branching (Eevee, 8 targets) and multiple independently valid methods to the same target
(Feebas -> Milotic) without hacks. See ADR-0011 for the full rationale, including why the two join
tables (`pokemon_form_ability`, `species_evolution`) have no independent external identity of their
own and are fully replaced per `source_id` on each ingestion run instead of upserted by identity.
Fully populated: 313 abilities, 3369 form/ability links, 553 evolution edges.

**Moves and learnsets** (Phase 1C.2, ADR-0013) are implemented too:
`supabase/migrations/20260912140000_move_version_reference.sql` adds `move` (canonical, ~937 rows),
`version_group` (~32 rows) and `move_learn_method` (~12 rows, slug-keyed, no name columns — labels
live in `packages/i18n`); `supabase/migrations/20260912141000_pokemon_form_move.sql` adds
`pokemon_form_move`, the form-aware learnset relation keyed by `(pokemon_form_id, move_id,
version_group_id, learn_method, level)` — `level` is part of the key because the same
form/move/version-group/method combination can occur at two different levels (a real relearn
mechanic, found in ~9.4k cases at full-dataset scale); `supabase/migrations/20260912142000_machines.sql`
adds `machine`, a minimal TM/HM/TR identity (`(move_id, version_group_id) → item_slug`, no item
detail modeled). See ADR-0013 for the full rationale, including why `pokemon_form_move` is the
largest table in the schema (~740k-750k rows estimated) and why that's an ingestion-batching
concern, not a Postgres scale problem.

Not yet implemented from "Likely early domains" below: items (beyond machine's raw item slug),
generations/games as first-class tables beyond `version_group` — deferred until a real feature
needs them (YAGNI).

### Seed vs. ingestion

`supabase/seed.sql` (run by `db:reset`) is schema-adjacent bootstrap data only — small, genuinely
static, deterministic lookup tables, if any ever exist. It is _not_ how Pokémon reference data gets
into the database. `species`/`pokemon_form`/`data_sources` are populated exclusively by
`packages/pokemon-data`'s ingestion pipeline (`pnpm --filter @pokelab/pokemon-data ingest`),
which upserts its own `data_sources` provenance row too. Phase 1A briefly hand-mirrored a 3-species
sample into `seed.sql`; that stopped being viable once the dataset became the real ~1025-species
Pokédex (see `packages/pokemon-data/README.md`) and was deliberately not continued at scale.

Local workflow is therefore two steps: `pnpm db:pi:migrate` (schema only, against the Raspberry
Pi — see "Raspberry Pi local development" above) then `pnpm ingest:pi` (data). Schema alone never
produces a Pokédex-ready database — this is intentional, not a regression from Phase 1A.

### Ingestion write strategy

Species/forms are upserted by upstream identity (`(source_id, external_id)`, unique-constrained —
not by slug), and an existing row's `slug` is preserved verbatim on every re-sync — only other
columns (name, types, stats, category) refresh. Each batch (500 rows) is one upsert statement,
atomic per Postgres; the ingestion run as a whole is not wrapped in one cross-batch transaction. If
a run fails partway, already-committed batches remain and the failure is reported with the exact
species/stage that failed — the fix is simply re-running ingestion, which is idempotent and
resumes/completes correctly rather than duplicating anything. A bespoke Postgres function/RPC for
true single-transaction, all-or-nothing ingestion was deliberately not built: for a dev ingestion
tool, "resumable via idempotent re-run" is a materially simpler correct answer to the same failure
mode (a mid-run crash) than the RPC would be. See `packages/pokemon-data/src/persist.ts`.

`ability` follows the same identity-based upsert. `pokemon_form_ability` and `species_evolution`
(Phase 1C.1) use a different strategy — every row for a given `source_id` is deleted and
re-inserted on each run, rather than upserted by identity — because neither has a stable external
id of its own (PokéAPI's `abilities[]`/`evolution_details[]` entries are array positions, not
addressable resources). Still idempotent (re-running produces the identical row set, not
duplicates); see ADR-0011 decision 3.

`move`/`version_group`/`move_learn_method`/`machine` (Phase 1C.2) follow the identity-based upsert
pattern too. `pokemon_form_move` follows the delete-and-reinsert pattern (same reasoning as
`pokemon_form_ability` — `version_group_details` entries are array positions upstream, ADR-0011
decision 3/ADR-0013), but at a different batch size: ~740k-750k rows estimated at full scale means
the default 500-row batch would need ~1500 round trips, so `persistDataset` uses a 2000-row batch
for this table only (`packages/pokemon-data/src/persist.ts`).

### Generated database types

`packages/database/src/generated-database-types.ts` (generated via `supabase gen types typescript
--local`) is the authoritative `Database` type as of Phase 1B — `src/types.ts` now only re-exports
it. Phase 0/1A hand-maintained a subset and hit real bugs from small omissions (a missing
`Relationships: []`, missing `Views`/`Functions`/`Enums`/`CompositeTypes` silently degrading query
results to `never`); with two real migrations now, that manual-sync risk outweighs avoiding a
generator step. Regenerate after every schema change (`packages/database/README.md`).

PostgREST's default 1000-row response cap (`max_rows` in `supabase/config.toml`) is a separate,
real constraint the full dataset exposed: any `.select()` without explicit `.range()` pagination
silently truncates past 1000 rows rather than erroring. Both the ingestion write path
(`packages/pokemon-data/src/persist.ts`) and `listSpecies` (`packages/database/src/queries.ts`)
paginate their reads past it.

### Supabase API keys

Supabase issues two key types per project (superseding the legacy `anon`/`service_role` JWTs,
which local `supabase start` still also prints and remain valid — nothing here requires migrating
an already-issued legacy key):

- **publishable key** (`sb_publishable_...`) — safe in browser code, RLS-governed. Client code
  uses `SupabasePublicConfig.publishableKey` (`packages/database/src/client.ts`).
- **secret key** (`sb_secret_...`) — server-only, bypasses RLS. Client code uses
  `SupabaseSecretConfig.secretKey`. Never expose to a client bundle; never log it (CLAUDE.md §15).

Environment variable naming is standardized on the key's _role_, not its exact format, so a
project can hold either a modern key or a legacy JWT in the same variable without a code change:

| Variable                               | Used by                                         | Key type    |
| -------------------------------------- | ----------------------------------------------- | ----------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | `apps/web` (browser + server)                   | —           |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `apps/web` (browser + server)                   | publishable |
| `SUPABASE_URL`                         | tooling (`packages/database`, ingestion, tests) | —           |
| `SUPABASE_PUBLISHABLE_KEY`             | tooling reading with anon-equivalent privilege  | publishable |
| `SUPABASE_SECRET_KEY`                  | ingestion writes, any privileged server task    | secret      |

`SUPABASE_URL`/`SUPABASE_PUBLISHABLE_KEY`/`SUPABASE_SECRET_KEY` (no `NEXT_PUBLIC_` prefix) are
deliberately separate from the web app's variables, even though local dev points both at the same
project — this lets ingestion/tooling target a different environment (e.g. the remote DEV Supabase
project) without touching `apps/web`'s configuration (the `SUPABASE_URL`-for-tooling split dates
to Phase 1B's ingestion pipeline; this change only renames the key variables, not that split).

## Likely early domains

Reference/data domains may include:

- generations,
- games,
- species,
- Pokémon/forms,
- types,
- abilities,
- moves,
- items,
- evolutions,
- learnsets,
- localized names/text,
- data source/version provenance.

User domains later:

- profiles,
- teams,
- team versions,
- collections,
- battle/replay metadata,
- preferences,
- sharing metadata.

Do not create all of these in Phase 0 unless required by the first real slice.

## Context modeling

Avoid assuming a Pokémon/move/item has one timeless definition.

Where relevant, preserve:

- generation,
- game,
- format/regulation,
- source version,
- effective time range.

Normalize only where normalization improves correctness and querying.

## Supabase Auth boundary

Application identity should expose a PokeLab user identifier and capabilities rather than leaking auth-provider-specific assumptions everywhere.

Initial providers may include:

- Google,
- Discord,
- email/magic link.

## RLS

Any table exposed through Supabase APIs that contains user-owned/private data requires explicit RLS/grant review.

Tests should prove:

- anonymous users cannot read private teams,
- users cannot read/write another user's private resources,
- explicitly public resources are readable under intended rules,
- service-only operations are not accidentally available client-side.

## Migration policy

- schema changes through migrations,
- no manual production-only schema drift,
- destructive migrations require explicit review,
- backfills separated from schema changes when operationally safer,
- seed data is deterministic and clearly distinguished from production imports.

### Before repeating an expensive operation (CLAUDE.md §22)

Migrations, full Pokémon ingestion, and large audits are not free — check state before rerunning:

- **Migration state**: `pnpm db:pi:migrate`'s dry-run (or `supabase migration list --db-url`)
  shows exactly what's pending; don't assume, check.
- **Ingestion**: a UI-only or documentation-only change never needs a rerun. A normalization/schema
  change needs targeted unit tests first (`packages/pokemon-data`'s fixture-based tests, no network
  call) — only run `pnpm ingest:pi` once those pass and a real schema/data change needs verifying
  end-to-end. `pnpm --filter @pokelab/pokemon-data audit` (report-only, no writes) is often
  enough to confirm a normalization change behaves correctly without writing anything.
- **Row counts/evidence**: a prior session's ingestion report (species/form/move counts, "N
  validation issues") is valid evidence of current state unless the schema or source data changed
  since — check `git log`/migration state before re-deriving it.
- A migration change still requires verify-then-apply-then-validate (`db:pi:check` →
  `db:pi:migrate` → targeted ingestion/query check) — this sequence is not the thing being
  optimized away, only _unnecessary repeats_ of it are.

## Portability

Avoid making PostgreSQL migration impossible by:

- keeping core schema SQL-compatible where reasonable,
- documenting Supabase-specific extensions/functions,
- isolating storage/auth/realtime-specific integrations,
- maintaining export/backup procedures before public beta.

## Guarded delivery

See [CI/CD](CI_CD.md) for the reviewed GitHub Actions pipeline, Environment configuration,
conditional ingestion, migration-history guards and the Cloudflare ownership handover.
Production remains unconfigured until explicitly approved.
