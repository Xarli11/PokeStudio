# PokeStudio — Data Sources & Provenance

## Goal

PokeStudio owns a normalized runtime data model while respecting source licenses, attribution and update constraints.

External sources are inputs, not runtime truth APIs.

## Implementation status (Phase 1A)

The real (non-spike) ingestion path is `packages/pokemon-data/scripts/ingest-explore.ts`:
fetches Bulbasaur, Rotom (+ its 5 battle-relevant appliance forms) and Meowth
(+ its 2 regional forms) from PokéAPI, normalizes them into the species/form
model (ADR-0010), validates dataset invariants, and writes a provenance-tagged
JSON artifact (`packages/pokemon-data/data/explore-species.json`). Run manually
(`pnpm --filter @pokestudio/pokemon-data ingest:explore`), not on every build or
page request. `packages/database/supabase/seed.sql` mirrors that exact output
into the local reference schema (`species` + `pokemon_form` tables). This is
still a deliberately small representative sample — see ADR-0010 for what
Phase 1 ingests next — not the complete Pokédex.

## Normalization strategy (Phase 1)

ADR-0010 defines how species/form/regional-form/battle-only-form/cosmetic-form,
generation-scoped types/stats, and game/format availability are modeled
without flattening away information Explore/Build/Battle Lab need. Phase 1A
implemented the species/form split and proved it against Rotom (6 forms
sharing base stats but differing types) and Meowth (regional forms differing
in both types _and_ base stats) — the remaining strategy (generation-scoped
stat history, game/format availability, moves/abilities/items/evolutions as
their own entities) stays deferred until a real feature needs it.

## Localized form names — a PokéAPI data-quality gap

PokéAPI's `pokemon-form` resource is inconsistent about which languages get a
full combined "Species Form" name: English is reliably present in `names`,
but Spanish is missing for every non-default form in this sample, and the
fallback field (`form_names`) means different things per form group (the full
name for Rotom's appliance formes, a generic "Forma de Alola"-style regional
descriptor for Meowth's regional formes — not that region's usable full name).
`packages/pokemon-data/src/normalize.ts` (`resolveFormName`) documents this
and composes the Spanish regional-form name (`"{species} de {region}"`) from
the species name + region label instead — a normalization rule grounded in
Nintendo's real, consistent regional-form naming convention, not a
per-Pokémon hardcode. Reconsider if a form group is found where this
composition rule doesn't hold.

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

### Phase 1A decision: no sprite/artwork source yet

No sprite/artwork source has been reviewed and approved for use. The Pokédex
UI (`apps/web/src/components/pokemon/visual-placeholder.tsx`) renders a
neutral, type-accented initial instead of any Pokémon sprite/artwork — not
PokéAPI's bundled sprites, not a GitHub-hosted asset repo, nothing scraped.
This is deliberate per this document's own principle ("do not assume an asset
is safe to use merely because it is hosted by PokéAPI or on GitHub") and
stays in place until a specific sprite/artwork source is reviewed, its
license confirmed, and that review recorded here.
