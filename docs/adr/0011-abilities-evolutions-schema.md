# ADR-0011: Abilities and evolutions schema (Phase 1C.1)

- Status: Accepted
- Date: 2026-09-10

## Context

ADR-0010 deferred abilities and evolutions until a real Phase 1 feature needed them ("Moves,
abilities, items and evolutions are their own entities... never duplicated inline"). Phase 1C.1 is
that feature: the Pokédex detail page should show each form's abilities and a Pokémon's evolution
family. Two schema decisions need recording.

## Decision 1 — abilities are canonical rows, forms join to them

`ability` (canonical: slug, English/Spanish name, English/Spanish effect where available,
provenance) is independent of `pokemon_form`. `pokemon_form_ability` joins them, carrying
PokéAPI's slot and `is_hidden` flag. This is the same shape ADR-0010 already used for
species/form: normalize what's shared, join what varies. Abilities are shared across hundreds of
forms (e.g. `overgrow` appears on every Grass starter's first stage); storing them inline per form
would duplicate the same English/Spanish text hundreds of times and make a future "abilities used
by more than N Pokémon" or "search by ability" query need string matching instead of a join.

Spanish name/effect are nullable, not backfilled — PokéAPI does not reliably provide either for
every ability (recorded in docs/engineering/DATA_SOURCES.md, matching the same real gap already documented for
form names). Inventing a translation would violate CLAUDE.md §14 ("no fake completeness").

## Decision 2 — evolutions are edges between species, not stage columns

**Rejected:** a `species` row (or a separate `evolution_chain` row) with `stage_1_id`/
`stage_2_id`/`stage_3_id` columns, or `previous_evolution_id`/`next_evolution_id` columns on
`species` itself.

**Why rejected:** Pokémon evolution is not a fixed-depth chain. Concrete cases a fixed-column
model cannot represent without hacks:

- **Branching**: Eevee evolves into 8 different species from one node — a fixed number of
  "next" columns (or even one `next_evolution_id`) cannot hold more than one child.
- **Multiple methods to the same target**: Feebas evolves into Milotic by reaching maximum
  Beauty (in some games) _or_ by trading while holding a Prism Scale (in others) — two distinct,
  independently valid condition sets for the identical edge. A single `evolution_method` column
  per parent/child pair cannot hold both without inventing a sub-table anyway — at which point the
  sub-table _is_ the edge model, just poorly named.
- **Convergence and asymmetric depth**: some families are 1 stage (Ditto has none), some are 2,
  some are 3, and stage count varies member-to-member within a single generation's roster. A fixed
  `stage_1/2/3` schema forces every row to carry unused nullable columns for the common
  1-2-stage case while still being unable to express a 4th stage if one is ever added.

**Decision:** `species_evolution` is one row per **edge**: `from_species_id -> to_species_id`
plus that edge's condition. A species with no evolution simply has zero rows referencing it — no
"N/A" stage columns to leave null. Branching is multiple rows sharing `from_species_id`.
Multi-method evolutions (Feebas) are multiple rows sharing `(from_species_id, to_species_id)`.
Depth is unbounded and asymmetric for free, because depth is just "how many edges long is the
path," not a schema property.

Each edge also carries `evolution_chain_external_id` (PokéAPI's own evolution-chain id) purely as
a grouping key, so a detail page can fetch one species' whole family (`packages/database/src/queries.ts`,
`getEvolutionFamily`) with two small indexed queries instead of a recursive SQL walk or a
full-table scan — not a second source of truth about chain structure, which the edges alone
already fully determine.

Structured condition columns (`min_level`, `item_slug`, `trigger`, `time_of_day`, `known_move_slug`,
...) cover the evolution methods Part B's requirements name explicitly. `raw_condition jsonb`
preserves PokéAPI's complete evolution-details entry verbatim alongside them, so a future
condition this migration didn't anticipate is not silently lost — CLAUDE.md §14 ("no fake
completeness") applies to schema coverage claims too: PokeLab does not claim to model every
condition PokéAPI can express, only the common ones, and says so via the raw column rather than
truncating data.

## Decision 3 — no independent identity for the two join tables

`pokemon_form_ability` and `species_evolution` rows have no stable external id of their own —
PokéAPI's `pokemon.abilities[]` entries and `evolution_details[]` entries are positions in an
array, not addressable resources. Rather than inventing a synthetic identity that could silently
drift if PokéAPI ever reorders either array, ingestion deletes and re-inserts every row for a
given `source_id` (a form's ability rows; a chain's evolution rows) each run — the write is still
idempotent (re-running produces the identical row set, not duplicates), it is just achieved by
full replacement instead of upsert-by-identity. Both tables are small (thousands of rows, not the
~1025/~1579-row scale that made `species`/`pokemon_form`'s slug-preserving upsert worth the extra
complexity), so this is the smaller correct solution, not a shortcut. See
`packages/pokemon-data/src/persist.ts`.

## Consequences

- Reconstructing a family's tree/branches for display is an application-level concern
  (`packages/database/src/queries.ts`), not a database recursive query — appropriate given a
  family is at most a few dozen rows.
- Adding a new evolution trigger PokéAPI introduces in a future generation needs no migration —
  `trigger` is `text`, not a checked enum, precisely so this stays true.
- `ability`/`pokemon_form_ability` follow the existing `species`/`pokemon_form` RLS pattern
  (public read, service-role-only write) with no new precedent.
