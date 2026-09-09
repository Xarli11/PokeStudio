# ADR-0010: Normalized Pokémon data strategy for Phase 1 ingestion

- Status: Accepted
- Date: 2026-09-09

## Context

The Phase 0 `public.species` table (`packages/database/supabase/migrations/20260908000001_reference_schema.sql`)
is an explicitly minimal spike: one row per species, with `types`/`base_stats`/
`introduced_in_generation` flattened onto that row. It exists to prove the migration/RLS/provenance
workflow, not to represent the real domain.

Before Phase 1 ingests the real dataset, Phase 0.5 requires reviewing whether a normalized model can
actually represent Pokémon's real complexity without flattening away information Explore/Build/Battle
Lab will need later — species vs. form vs. regional/battle-only/cosmetic form, stats and types that
change by generation, per-game/per-format availability, learnsets, evolution chains, localized names,
and provenance.

## Decision

Adopt the following normalization strategy for Phase 1, and implement only the subset Phase 1's
Pokédex slice genuinely needs (YAGNI — do not create every table below on day one):

1. **Species vs. form are separate concepts.** A `species` row is the dex-number-bearing identity
   (e.g. Rotom, Deoxys). A `pokemon_form` (or equivalent) row belongs to a species and represents
   a specific expression of it — default form, regional form (Alolan/Galarian/Hisuian/Paldean),
   battle-only form (Mega, primal, Ash-Greninja), and cosmetic form (Vivillon patterns, Unown).
   Forms carry their own types/base stats/sprite; species carries dex number, evolution family,
   and localized names shared across its forms unless a form overrides them.
2. **Types and base stats are versioned by generation, not global.** Where a form's types or stats
   differ by generation (e.g. Clefable pre-Fairy, base stat changes over time), that data is scoped
   to a `(form, generation_introduced_or_changed)` pair rather than a single flat column — modeled
   as an effective-range/changelog, not a full historical table per generation unless a real Phase 1
   feature needs to render a specific past generation's numbers.
3. **Game/format availability is its own relation**, not inferred from `introduced_in_generation`.
   A form can exist in the data model before it is obtainable in every game of that generation
   (event-only, DLC-only, version-exclusive). Model this as a join between forms and games/formats
   only once a Phase 1 feature needs to answer "is this available in game X" — do not pre-populate
   speculative rows.
4. **Moves, abilities, items and evolutions are their own entities**, referenced by id/slug from
   forms — never duplicated inline as free text on the species/form row, since they are reused
   across hundreds of forms and need independent localization and (for moves) per-generation data
   of their own (power/accuracy/effect changes).
5. **Every table carries a canonical PokeStudio id/slug distinct from any external source id.**
   External ids (PokéAPI numeric ids, etc.) are recorded as provenance/source references
   (`source_id` + external id), never used as PokeStudio's primary key — so a future source change
   or multi-source merge does not require renumbering the domain.
6. **Localized names live alongside the canonical row** (as Phase 0 already does with `name_en`/
   `name_es` columns) for the small, fixed locale set; move to a separate `localized_text` table
   only if the number of localizable fields or locales grows enough that per-locale columns become
   unwieldy.
7. **Provenance is mandatory per imported row**, continuing the Phase 0 `data_sources` pattern:
   every table populated by ingestion carries a `source_id` foreign key, and the pipeline records
   source revision/fetch time/importer version per DATA_SOURCES.md.

## What Phase 1 actually builds

Only what the Pokédex index/detail/compare slice (ROADMAP.md Phase 1) needs: `species`,
`pokemon_form` (collapsed to "one row per form, generation-scoped stats/types only where they
actually differ historically — most forms don't"), `move`/`ability`/`item` reference tables, and
the existing `data_sources` provenance table. Game/format availability, full learnsets, and
evolution-chain graph tables are deferred until a concrete Phase 1/2 feature (legality validation,
learnset display) requires them — per-table justification, not built speculatively.

## Consequences

- Phase 1 migrations replace the Phase 0 flattened `species` spike table; the spike's shape
  (types/base_stats as columns on one row) is not carried forward as-is once forms exist.
- Ingestion (`packages/pokemon-data`) must normalize PokéAPI's own (differently-shaped) data into
  this model rather than passing it through — PokéAPI is an input, not the runtime schema
  (CLAUDE.md §10).
- Historical/generation-scoped data is modeled as an effective-range/changelog, not one column per
  generation — keeps the common case (a form whose stats never changed) cheap while still
  representing the rare case (a form whose stats did change) correctly.
- Queries that only need "current" data (the common case for Explore) stay simple; generation-aware
  queries are an explicit, opt-in join, not the default path.

## Phase 1B addendum — validated at full dataset scale

The species/form split (decision #1) was ingested and proved against the complete PokéAPI dataset
(~1025 species, ~1579 forms), not just the 3-species Phase 1A sample — including cases the sample
couldn't exercise: a 64-form cosmetic family (Alcremie), a species with no default-named form at
all (Xerneas), and forms that change type without any PokéAPI battle-only/mega flag (Rotom). No
change to the decision itself; see DATA_SOURCES.md "Classification findings" and
`packages/pokemon-data/src/classify.ts` for what the full-scale audit found and how it was
generalized (not patched per-species). Decision #5 (canonical id/slug distinct from external id)
is now also enforced at the database level via a `unique (source_id, external_id)` constraint,
which the ingestion pipeline's idempotent upsert depends on.
