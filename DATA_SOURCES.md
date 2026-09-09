# PokeStudio — Data Sources & Provenance

## Goal

PokeStudio owns a normalized runtime data model while respecting source licenses, attribution and update constraints.

External sources are inputs, not runtime truth APIs.

## Implementation status (Phase 0)

A working ingestion spike exists at `packages/pokemon-data/scripts/ingest-spike.ts`:
fetches a 3-species sample from PokéAPI, normalizes it to the PokeStudio schema,
validates dataset invariants, and writes a provenance-tagged JSON artifact
(`packages/pokemon-data/data/spike-species.json`). It is run manually
(`pnpm --filter @pokestudio/pokemon-data ingest:spike`), not on every build or
page request. `packages/database/supabase/seed.sql` loads the same sample into
the local reference schema. This is a pipeline-shape proof, not the Phase 1
dataset.

## Normalization strategy (Phase 1)

The Phase 0 `species` table is a flattened spike, not the Phase 1 schema. ADR-0010 defines how
species/form/regional-form/battle-only-form/cosmetic-form, generation-scoped types/stats, and
game/format availability will be modeled without flattening away information Explore/Build/Battle
Lab need — implemented incrementally, only as far as each phase's real feature requires.

## Candidate sources

### PokéAPI / PokéAPI data repositories

Potential uses:

- species/reference data,
- moves,
- abilities,
- items,
- localized names/text,
- game/version relationships.

Before importing, record:

- exact repository/API source,
- license,
- revision/version/date,
- transformation performed.

### Pokémon Showdown server/simulator data

Potential uses:

- mechanics-adjacent structured data,
- formats,
- learnsets/data required by simulator integration.

The Pokémon Showdown server is distributed under MIT. Preserve notices and verify the exact files/package boundary used.

### Smogon damage calculator

`@smogon/calc` is MIT-licensed and intended to be usable as a programmatic damage calculation building block.

### Competitive statistics

Do not scrape competitor websites casually.

For every source determine:

- whether automated access is permitted,
- license/terms,
- attribution requirements,
- update cadence,
- whether historical storage is permitted.

Prefer primary/public datasets and community sources with clear reuse terms.

## Provenance record

Every imported dataset should be traceable to:

- `source_id`,
- source URL/repository,
- upstream revision/version,
- fetched/imported time,
- license identifier/notice,
- importer version,
- checksum where useful.

## Pipeline

```text
fetch/read source
    ↓
parse
    ↓
normalize
    ↓
validate invariants
    ↓
compare/diff
    ↓
write versioned data
    ↓
application consumption
```

## Validation examples

- unique stable identifiers,
- form/species relationships,
- type validity,
- move references exist,
- evolution graph integrity,
- localized values map to known entities,
- generation/game context is not silently lost.

## Update policy

Automate routine updates once the pipeline is reliable.

Do not auto-publish major upstream changes without validation if they can affect legality, mechanics or SEO content.

## Asset policy

Code/data licenses do not grant Pokémon media rights.

For sprites/artwork/icons:

- maintain source and permission/provenance,
- avoid “found on the internet” assets,
- separate replaceable assets from core code,
- do not assume official assets are commercially reusable,
- include an unofficial/fan-project disclaimer where appropriate.
