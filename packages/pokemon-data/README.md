# @pokestudio/pokemon-data

Full Pokédex ingestion pipeline (Phase 1B/1C.1/1C.2, ADR-0010, ADR-0011, ADR-0013): fetch/cache →
normalize → validate → persist. Not a runtime PokéAPI client — the web app never imports this
package or calls PokéAPI at request time (CLAUDE.md §10); it only reads what this pipeline already
wrote to Postgres, via `@pokestudio/database`.

## Commands

Requires a running local Supabase instance with the schema migrations applied
(`pnpm --filter @pokestudio/database db:start && pnpm --filter @pokestudio/database db:reset`)
and `SUPABASE_URL`/`SUPABASE_SECRET_KEY` set (`db:start` prints `SECRET_KEY`; see `.env.example`
and DATABASE.md "Supabase API keys"). To target Supabase Cloud instead of local, set `SUPABASE_URL`
to the project's URL and `SUPABASE_SECRET_KEY` to its secret key (`sb_secret_...`, from the
project's API settings) — never commit either.

```bash
pnpm --filter @pokestudio/pokemon-data ingest   # full pipeline: fetches, normalizes, validates, writes
pnpm --filter @pokestudio/pokemon-data audit     # same pipeline, report-only — no DB writes, no secret key needed
```

Both accept:

- `--limit=N` — only the first N species (fast iteration; the default is the full ~1000+ species)
- `--concurrency=N` — requests in flight per fetch phase (default 12)
- `--no-cache` — bypass the on-disk raw-response cache and hit PokéAPI directly

`ingest` prints a classification/localization/abilities/evolutions audit and a performance report
(request count, fetch/persist duration, species/form/ability/evolution counts) on completion.
Non-zero exit and no DB writes if validation fails.

## Pipeline shape

```text
fetch (species list -> species detail -> variety/pokemon detail -> per-form detail
       -> unique ability detail -> unique evolution-chain detail
       -> move list -> move detail -> unique machine detail
       -> version-group list/detail -> move-learn-method list/detail)
    ↓  (bounded concurrency, on-disk cache — packages/pokemon-data/.cache/, gitignored)
normalize (species + form + ability + form/ability link + evolution edge
           + move + version group + learn method + form/move learnset entry + machine —
           packages/pokemon-data/src/classify.ts, src/normalize.ts)
    ↓
validate (invariants — packages/pokemon-data/src/validate.ts; failure blocks persist entirely)
    ↓
persist (species/forms/abilities/moves/version-groups/learn-methods/machines: batched upsert by
         (source_id, external_id) identity; form/ability links + evolution edges + learnset
         entries: batched full replacement per source_id —
         packages/pokemon-data/src/persist.ts, ADR-0011 decision 3/ADR-0013)
```

Fetch and normalize are pure/testable independently: `src/normalize.ts`'s tests use literal
fixture JSON, never a live network call. Each fetch phase (species → varieties → forms → unique
abilities → unique evolution chains) runs through one flat, globally-bounded-concurrency pool
(`src/concurrency.ts`) rather than nested per-species concurrency, so total requests in flight never
exceeds `--concurrency` regardless of how large one species' form family is (Alcremie: 64 forms
under a single species) or how many species reference the same ability/chain (abilities and
evolution chains are each fetched once per unique URL, not once per reference — most abilities are
shared by dozens of Pokémon, and every stage of a chain points at the same chain resource).

## Idempotency

Re-running `ingest` never duplicates species/forms/abilities: rows are matched by upstream identity
(`source_id` + `external_id`, not slug), and an existing row's `slug` is always preserved verbatim
on update — only other fields (name, types, stats, category, effect text) refresh. The two join
tables without an independent upstream identity (`pokemon_form_ability`, `species_evolution`) are
instead fully replaced per `source_id` on each run — still idempotent (identical row set, never
duplicated), just not identity-preserving since there is no stable identity to preserve (ADR-0011
decision 3). See `src/persist.ts`'s top comment for the full write strategy, and
`tests/persist.integration.test.ts` for the executable proof (species/forms/abilities upsert
in place; form/ability links and evolution edges never accumulate across runs, and correctly
shrink when a re-fetch drops a row).

## Abilities and evolutions (Phase 1C.1, ADR-0011)

`src/normalize.ts` adds three functions alongside `normalizeSpeciesGroup`:

- `normalizeFormAbilities(formSlug, abilities)` — abilities are a per-_variety_ PokéAPI attribute,
  not per-`pokemon-form`, so every cosmetic sub-form under one variety gets the same ability links
  as its variety (same rule already applied to types/base stats).
- `normalizeAbility({ability, sourceId})` — canonical ability row; leaves Spanish name/effect
  `undefined` (never invented) when PokéAPI has no entry — see DATA_SOURCES.md for how often that
  happens (effect: always; name: rarely).
- `normalizeEvolutionChain({chain, sourceId})` — walks one PokéAPI evolution-chain tree into flat
  edges. The chain's root produces no edge; every other node produces one edge per entry in its
  `evolution_details` (branching = multiple edges sharing `fromSpeciesSlug`; multiple valid methods
  to the same target, e.g. Feebas -> Milotic, = multiple edges sharing both `fromSpeciesSlug` and
  `toSpeciesSlug`).

See its tests for representative real families: a plain linear 3-stage chain (Bulbasaur), an
8-way branch with a mix of item/friendship/time-of-day conditions (Eevee), a species-vs-defense
stat branch (Tyrogue), and a genuinely multi-method single edge (Feebas -> Milotic).

## Form classification

`src/classify.ts` centralizes every classification rule (default/regional/battle/cosmetic) —
driven by PokéAPI's own structural signals (`is_mega`, `is_battle_only`, a form's types/stats vs.
its species' default variety), plus one small, documented, centralized exception list
(`REGION_LABELS`) for regional-form detection. No per-Pokémon `if name === ...` branches. See its
tests for the representative edge cases this was built and hardened against (Rotom's unflagged
type-changing appliance forms, Vivillon's unreliable per-form `is_default`, Xerneas' two-state
default-form quirk).

## Moves and learnsets (Phase 1C.2, ADR-0013)

`src/normalize.ts` adds:

- `normalizeMove({move, sourceId})` — canonical move row. Sanitizes a Z-Move variant's raw
  `--physical`/`--special` double-dash name into a valid single-dash slug; leaves `ailment`/
  `category` `undefined` (never a guessed default) when PokéAPI's `meta` block is entirely absent
  (a real, current gap for ~110 of 937 moves); treats a literal `power`/`accuracy` of `0` the same
  as PokéAPI's own `null` (both mean the identical real absence upstream).
- `normalizeFormMoves(formSlug, moves)` — same per-variety-shared-by-every-cosmetic-form rule as
  `normalizeFormAbilities`. `level` is part of the natural key, not just `(form, move,
version_group, method)` — the same combination can legitimately occur at two different levels
  (~9.4k real cases at full scale, e.g. a move both inherited on evolution and re-taught later).
- `normalizeVersionGroup`/`normalizeLearnMethod`/`normalizeMachine` — small reference-table
  normalizers, same identity-provenance shape as `normalizeAbility`.

`fetchAndNormalize` (`src/pipeline.ts`) explicitly excludes the handful of moves carrying PokéAPI's
non-standard `"shadow"` type (Pokémon Colosseum/XD's Shadow Pokémon mechanic — a battle-only
overlay PokeStudio's `PokemonType` domain doesn't model) and their learnset entries, rather than
letting them surface as validation orphans.

See `src/audit.ts`'s `moves`/`learnsets` report sections and DATA_SOURCES.md "Moves and learnsets"
for the full list of full-dataset-only findings and how each was handled.
