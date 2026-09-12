# Third-Party Notices — Working Inventory

This file is a planning inventory. Replace/update it with exact notices required by the actual dependencies introduced into the repository.

## Pokémon Showdown server/simulator

Repository: https://github.com/smogon/pokemon-showdown

Package used: `pokemon-showdown@0.11.11` (npm), consumed via its `dist/sim/index.js`
entry point (`BattleStream`, `Teams`, `getPlayerStreams`) behind
`packages/battle-engine`. The full server (chat, SQL persistence) is not used;
`better-sqlite3` and other server-only `optionalDependencies` are not installed.

License reported by upstream repository and confirmed via `npm view`: MIT.

Action before shipping:

- preserve required MIT copyright/license notice,
- verify no separately licensed assets/client code are copied unintentionally.

## Smogon damage calculator / `@smogon/calc`

Repository: https://github.com/smogon/damage-calc

Package used: `@smogon/calc@0.11.0` (npm), behind `packages/damage`.

License reported by upstream repository and confirmed via `npm view`: MIT.

Action before shipping:

- preserve required MIT notice.

## PokéAPI (data source, not a software dependency)

Repository: https://github.com/PokeAPI/pokeapi

Used by the Phase 1A ingestion script (`packages/pokemon-data/scripts/ingest-explore.ts`)
to fetch a small, versioned species sample (see
`packages/pokemon-data/data/explore-species.json` for the provenance record).
Not called at runtime by the web app (CLAUDE.md §10).

No sprite/artwork/icon assets from PokéAPI or any other source have been
introduced — Pokédex visuals use a neutral placeholder pending a reviewed,
license-cleared asset source (docs/engineering/DATA_SOURCES.md "Asset policy").

License: BSD-3-Clause (confirmed via the repository's `LICENSE.md`). Requires
retaining the copyright notice; Pokémon names/characters remain Nintendo
trademarks per the same notice.

## Future dependencies

Every strategic dependency must be added here or to the generated legal inventory with:

- name,
- version,
- source,
- license,
- usage,
- notice/attribution requirements.

Pokémon media/assets require separate provenance review and are not automatically licensed by these software repositories.
