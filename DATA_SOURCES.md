# PokeStudio — Data Sources & Provenance

## Goal

PokeStudio owns a normalized runtime data model while respecting source licenses, attribution and update constraints.

External sources are inputs, not runtime truth APIs.

## Implementation status (Phase 1C.1)

The real ingestion path is `packages/pokemon-data/scripts/ingest.ts`: fetches the _complete_
PokéAPI species/form dataset — every species (~1025), every variety (~1351: default + regional +
battle-only forms), every cosmetic sub-form under each variety (~1579 forms total) — plus every
unique ability referenced (313) and every unique evolution chain (339, 553 edges) — normalizes into
the species/form/ability/evolution model (ADR-0010, ADR-0011), validates dataset invariants, and
upserts directly into Postgres by upstream identity (idempotent — species/forms/abilities by
`(source_id, external_id)`; the two join tables, which have no independent upstream identity, by
full replacement per source_id — ADR-0011 decision 3). Run via `pnpm --filter @pokestudio/pokemon-data
ingest`; `pnpm --filter @pokestudio/pokemon-data audit` runs the same fetch/normalize/validate
pipeline report-only, without touching the database. See `packages/pokemon-data/README.md` for the
full pipeline shape, fetch/cache strategy and idempotency guarantee.

Phase 1A's small hand-mirrored 3-species sample (`seed.sql`) has been fully superseded — see
DATABASE.md "Seed vs. ingestion."

## Normalization strategy (Phase 1)

ADR-0010 defines how species/form/regional-form/battle-only-form/cosmetic-form,
generation-scoped types/stats, and game/format availability are modeled
without flattening away information Explore/Build/Battle Lab need. Phase 1A proved the species/
form split on 3 representative species; Phase 1B proved the same model holds across the real,
complete dataset — including cases the small sample couldn't exercise (see "Classification
findings" below). The remaining deferred strategy (generation-scoped stat history, game/format
availability, moves/abilities/items/evolutions as their own entities) stays deferred until a real
feature needs it.

## Classification findings (Phase 1B, full-dataset audit)

`packages/pokemon-data/src/classify.ts` classifies every form generically — driven by PokéAPI's
own signals, never a per-Pokémon hardcode. Two real edge cases the full dataset surfaced and fixed
during Phase 1B, both centralized as general rules (not species-specific patches):

- **Rotom's appliance forms aren't flagged `is_mega`/`is_battle_only`** by PokéAPI (they're
  obtainable outside battle), so classifying purely on those flags put them in `cosmetic` despite
  changing types. Fixed by comparing each variety's types/stats against its species' default
  variety: a mechanical difference (type or stat change) now classifies as `battle` regardless of
  those flags. This also improved Indeedee's gender-differentiated variety (different base stats)
  from a previous mis-fit `cosmetic` default to the more accurate `battle`.
- **Xerneas has no form named plain "xerneas"** — only `xerneas-active`/`xerneas-neutral` — so the
  name-match rule for picking a variety's canonical form found nothing, and the naive fallback (API
  array order) picked the wrong one (`active`, which is `is_battle_only: true`). Fixed by falling
  back to PokéAPI's own `is_default` form-level flag when _exactly one_ form claims it (reliable
  for a real two-state species like Xerneas; deliberately not used when _every_ form claims it,
  which is the common case for cosmetic groups like Vivillon where that flag is meaningless).

Final distribution (full dataset): 1025 `default`, 220 `battle`, 54 `regional`, 280 `cosmetic`.
Largest cosmetic families: Alcremie (64 forms — flavor/cream combinations), Unown (28 — letters),
Vivillon/Scatterbug/Spewpa (20 each — regional wing patterns), Arceus (19 — Plates), Silvally (18).

## Localized form names — a PokéAPI data-quality gap

PokéAPI's `pokemon-form` resource is inconsistent about which languages get a
full combined "Species Form" name: English is reliably present in `names`,
but Spanish is missing for most non-default forms, and the
fallback field (`form_names`) means different things per form group (the full
name for Rotom's appliance formes, a generic "Forma de Alola"-style regional
descriptor for Meowth's regional formes — not that region's usable full name).
`packages/pokemon-data/src/normalize.ts` (`resolveFormName`) documents this
and composes the Spanish regional-form name (`"{species} de {region}"`) from
the species name + region label instead — a normalization rule grounded in
Nintendo's real, consistent regional-form naming convention, not a
per-Pokémon hardcode.

At full-dataset scale (Phase 1B audit): of 554 non-default forms, 273 have a genuine PokéAPI-
provided Spanish name, 54 use the regional composition above (correct by design, not a gap), and
227 fall back further still — composing `"{species} ({descriptor})"` from the species name and the
form's short English-only `form_name` field (e.g. "Charizard (gmax)") because _neither_ `names` nor
`form_names` had a usable Spanish string. That fallback is deliberately never left bare (never just
"gmax" with no species name attached) and is deterministic. No manual translation was done for
these 227 — `pnpm --filter @pokestudio/pokemon-data audit` lists them for future review; a
centralized override table would be the right mechanism if any of these need a hand-authored name,
not scattered fixes.

## Abilities — a worse PokéAPI Spanish-localization gap than forms (Phase 1C.1)

`packages/pokemon-data/src/normalize.ts` (`normalizeAbility`) leaves `nameEs`/`effectEs`
`undefined` — never invented — when PokéAPI has no entry, same principle as form names above. The
actual gap is more severe here than for form names: at full-dataset scale, PokéAPI provides a
Spanish ability **name** for 310 of 313 abilities (only 3 missing), but a Spanish ability
**effect** for **zero** of them — `effect_entries` in this dataset never contains an `es` entry at
all, only `en`. The web UI falls back to "no description available" in Spanish rather than showing
the English effect mislabeled as Spanish, or leaving it blank with no explanation
(`apps/web/src/components/pokemon/ability-list.tsx`). This is a real, current upstream gap, not a
transient one — a future improvement here would need either a different/supplementary source for
Spanish ability effect text or a hand-authored translation table, not a PokéAPI fallback field
(there isn't one).

## Evolution conditions — not version-group-scoped, so "alternative methods" can over-count

`packages/pokemon-data/src/normalize.ts` (`normalizeEvolutionChain`) produces one `species_evolution`
edge per entry in PokéAPI's `evolution_details` array, preserving every entry rather than picking
"the" canonical one — correct per ADR-0011 (an edge/graph model, not a lossy simplification). But
PokéAPI does not scope `evolution_details` entries by game version in the API response: when a
species' evolution method differs by game generation only in _which special location_ triggers it
(not in the underlying method), each game's location surfaces as its own `evolution_details` entry.
At full-dataset scale this is common — e.g. Magneton -> Magnezone has 7 stored condition entries
(6 "level up at a specific location" variants across different games, plus the modern "use Thunder
Stone" alternative added later), and Eevee -> Leafeon has 6 (5 location variants + the Leaf Stone
item alternative). Naively surfacing all 7/6 as "7 ways to evolve" / "6 ways to evolve" would
overstate genuine mechanical diversity. PokeStudio does not lose this data (every row is kept, with
its `raw_condition` preserved verbatim) but the web UI's evolution-condition formatter deliberately
never renders the location's actual value (only a fixed "at a special location" phrase — see
`apps/web/src/lib/evolution-condition.ts`), which lets location-only variants collapse to one
displayed line by comparing rendered strings, while item/trade/happiness-based alternatives (which
render distinctly) still show separately. A real, structural fix — storing/filtering by version
group — was deliberately not built for Phase 1C.1 (Part B explicitly scopes out "a perfect
universal rule engine"); this display-level workaround is the documented, honest interim answer.

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

### Fetch strategy (PokéAPI, Phase 1B)

The full dataset needs ~4200 requests (species detail + variety detail + per-form detail). Fetched
through bounded concurrency (default 12 in flight, `packages/pokemon-data/src/concurrency.ts`) in
three flat phases (species → varieties → forms), not thousands of sequential requests nor
per-species nested concurrency that could multiply unpredictably for a large form family. Every raw
response is cached to disk by URL (`packages/pokemon-data/.cache/`, gitignored, mirrors the API
path shape) — a full run takes ~40-60s cold and under a second warm; re-running `ingest` or `audit`
after the first successful fetch touches the network 0 times. No static bulk dataset/mirror was
adopted for this — PokéAPI's live REST API plus this caching was materially simpler for the current
scope, and remains an option to revisit if request volume ever became a real problem.

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
UI (`apps/web/src/components/pokemon/art-slot.tsx`, redesigned in UX/UI 0.2 —
previously `visual-placeholder.tsx`) renders a neutral, type-accented
composition (gradient wash + monogram + ring accent) instead of any Pokémon
sprite/artwork — not PokéAPI's bundled sprites, not a GitHub-hosted asset
repo, nothing scraped. This is deliberate per this document's own principle
("do not assume an asset is safe to use merely because it is hosted by
PokéAPI or on GitHub") and stays in place until a specific sprite/artwork
source is reviewed, its license confirmed, and that review recorded here.
`art-slot.tsx`'s own doc comment records how a future approved image would
slot in (replacing just the monogram `<span>`, same outer frame) so that
day doesn't require a card/page redesign.
