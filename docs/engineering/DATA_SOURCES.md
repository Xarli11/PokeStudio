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
docs/engineering/DATABASE.md "Seed vs. ingestion."

## Moves and learnsets (Phase 1C.2)

Ingestion also fetches the complete move roster (~937), every version group (32), every learn
method (12), and every unique machine (TM/HM/TR) a learnable move actually references, then
upserts `move`/`version_group`/`move_learn_method` by identity and `pokemon_form_move`/`machine`
per ADR-0013. Two real upstream inconsistencies were found only at full-dataset scale (a 3-move
sample can't surface them) and are handled explicitly, not silently:

- **"No power"/"never misses" is encoded two different ways.** Most status moves use PokéAPI's
  `null` for `power`/`accuracy`, but several (`power-shift`, `victory-dance`, `shelter`,
  `burning-bulwark`, ...) use literal `0` for the identical real absence. Both normalize to the
  same `undefined` (`packages/pokemon-data/src/normalize.ts`) — no move ever has a genuinely
  displayed power/accuracy of exactly 0 in-game.
- **~110 of 937 moves have no `meta` block at all** — mostly very recent Generation IX moves
  (`ivy-cudgel`, `population-bomb`, `hydro-steam`) and a handful of id-10000+ placeholder moves for
  an unreleased game. `move.ailment`/`move.category` are nullable at the DB level for exactly this
  reason; never backfilled with a guessed `"none"`/`"damage"` default (CLAUDE.md §14).
- **5 moves have PokéAPI's non-standard `"shadow"` type** (`shadow-rush`, `shadow-blast`, ...) —
  exclusive to Pokémon Colosseum/XD's Shadow Pokémon mechanic, a battle-only overlay, never a real
  Pokémon type. PokeStudio's `PokemonType` domain doesn't model it (mainline mechanics only, this
  phase), so these 5 are explicitly excluded from ingestion — along with their learnset entries,
  which would otherwise become orphans — rather than silently miscast into a real type.
- **A handful of signature Z-Moves are split into two PokéAPI records** sharing one display name,
  disambiguated only by a `--physical`/`--special` suffix (e.g. `breakneck-blitz--physical`) — not
  two separately-named in-game moves, just PokéAPI's own per-variant modeling. The double dash is
  collapsed to a single dash for a valid slug (`sanitizeMoveSlug`), applied consistently to both the
  canonical move and any learnset entry referencing it.

Not modeled (documented limitation, not a silent gap): PokéAPI's `past_values` (historical
per-generation power/accuracy/type changes, e.g. Thunderbolt's power was 95 before Generation VI) —
`move` stores only the current mechanics. See ADR-0013 for the full schema rationale and the
"Full-dataset ingestion addendum" for exactly how each of the findings above was discovered and
fixed.

## Natures and items (Milestone 2, Stage 2.0)

Natures (`/nature`) are ingested whole — all 25, including the 5 neutral ones (both
`increased_stat`/`decreased_stat` null). A first migration's constraint
(`increased_stat is distinct from decreased_stat`) rejected every neutral nature in practice: `NULL
IS DISTINCT FROM NULL` evaluates to `false` in Postgres, not `true` as the name suggests — fixed in
a follow-up migration (`increased_stat is null or increased_stat != decreased_stat`) rather than
editing the already-applied one, per this repo's migration convention.

Items are the one case in this phase where PokéAPI's raw `/item` list (2223 rows) was deliberately
**not** ingested whole — most are key items, TMs, mail, and other inventory concepts irrelevant to
a held-item selector. Rather than a fragile string/category-name heuristic, ingestion calls
PokéAPI's own `/item-attribute/holdable` index, which returns exactly the 175 items the games
themselves flag as valid to hold — an authoritative, deterministic filter already modeled upstream,
not a Ponytail-violating reimplementation of "does this look like a held item."

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

### RESOLVED (audited 2026-09-16, corrected same day): the 49 "Mega Dimension" forms are official, current content — earlier draft of this section was wrong

An earlier version of this section classified 49 of 99 "mega"-slugged
`pokemon_form` rows as non-canonical fan content, based on their upstream
`version_group: "mega-dimension"` looking like a fictional/community bucket.
**That conclusion was incorrect** and is corrected here after the owner
flagged it and a second, deeper audit was run. Left in place (corrected,
not deleted) as an honest record of the mistake and the correction, per
this project's own documentation discipline.

**The facts, re-verified against Bulbapedia (current canonical reference)
and PokéAPI directly:**

- **99 total** `pokemon_form` rows with a "mega" slug, all `source_id:
pokeapi`. Breakdown:
  - **50 classic** Mega Evolutions (X/Y: 28, Omega Ruby/Alpha Sapphire: 18,
    Charizard/Mewtwo each having X and Y — matches the pre-2025 canonical
    total).
  - **26 introduced with Pokémon Legends: Z-A's base game** (released 2025) — e.g. `clefable-mega`, `victreebel-mega`, `starmie-mega`,
    `dragonite-mega`, `meganium-mega`.
  - **23 introduced with Z-A's Mega Dimension DLC**, across 18 species,
    including three species gaining a **second, additional** "Z Mega
    Evolution" on top of their existing classic Mega
    (`garchomp-mega-z`, `lucario-mega-z`, `absol-mega-z` — an official
    game mechanic, confirmed via Bulbapedia's own "Z Mega Evolution"
    entry, sourced to Pokémon Legends: Z-A – Mega Dimension's own press
    materials) plus multi-form species counted with more than one row
    each (`raichu-mega-x`/`-y`, `magearna-mega`/`-original-mega`,
    `tatsugiri-curly-mega`/`-droopy-mega`/`-stretchy-mega`).
  - **0 genuinely non-canonical rows.** Every one of the 99 is real,
    current, official Pokémon content.
- Both `legends-za` and `mega-dimension` are real PokéAPI `version-group`
  resources (generation IX) — **and both are already present in this
  project's own ingested `version_group` table** (32 rows, confirmed by
  direct query), ingested 2026-09-14. The earlier draft's claim that
  `mega-dimension` was "not one of the 32 real version groups this project
  ingests" was simply wrong — it hadn't actually queried the table, only
  a hardcoded display-name lookup map that happened to be missing an entry
  for it. `version-group-label.ts`'s human-readable name map has an entry
  for `legends-za` but not yet for `mega-dimension`/`champions` — not a
  correctness bug (the humanized-slug fallback already renders "Mega
  Dimension"/"Champions", never a raw slug), just a small future polish
  item.
- **No remediation needed for the forms themselves. No rows should be
  filtered, deleted, or excluded.** The originally proposed
  "filter by real ingested version_group" remediation is retracted — had
  it been executed, it would have deleted 49 genuinely official rows.
- **RETRACTED (2026-09-16, same-day correction): the "external_id drift"
  finding below was a false alarm caused by an audit methodology error, not
  a real upstream data-stability problem.** The original comparison queried
  PokéAPI's `pokemon/{name}` (variety) resource's own `.id` and compared it
  against this project's stored `pokemon_form.external_id` — but
  `normalize.ts` has always sourced `external_id` from the **`pokemon-form`**
  resource's `.id` instead (a different, independent numbering sequence).
  Re-verified directly against the correct endpoint for every example
  previously cited (`venusaur-mega`, `clefable-mega`, `raichu-mega-x`,
  `garchomp-mega-z`, `baxcalibur-mega`, `charizard-mega-x`,
  `charizard-gmax`, `pikachu-alola-cap`): **all match exactly, zero drift**.
  A follow-up branch (`fix/pokemon-form-ingestion-identity`) additionally
  built a reusable, read-only diagnostic
  (`packages/pokemon-data/scripts/diagnose-form-identity.ts` —
  `pnpm --filter @pokestudio/pokemon-data diagnose-form-identity`) that
  fetches fresh upstream data through the real ingestion pipeline and
  compares it against the live Pi `pokemon_form` table by slug; run
  2026-09-16 against the actual Pi data, it confirmed **0 of 1579 rows
  would update, 0 new, 0 missing — the current `(source_id, external_id)`
  upsert identity is safe as-is.** No schema or ingestion-identity change
  was made. The speculative migration and `persist.ts` change drafted
  before this correction was found were reverted (Ponytail/YAGNI — no bug
  to fix). Kept: the diagnostic script itself, as a reusable, zero-risk
  health check for the next time this is worth re-verifying (e.g. before
  a Cloud DEV ingestion).
- **User-facing exposure**: since these are all genuinely official forms,
  their appearance in Explore search / Compare / Build's add-Pokémon
  picker (via `getSpeciesSearchIndex`'s non-default-form aliases) is
  correct behavior, not contamination — no change needed there.
- **A real, separate, already-known Build limitation this confirms
  concretely**: Build's species-availability validation
  (`speciesUnavailableInGeneration`, added in an earlier pass) checks the
  _species'_ generation of introduction, not the _form's_ — so selecting
  "Red/Blue" as the game and adding the `clefable-mega` form specifically
  would currently be treated as available (Clefable-the-species is
  Generation I) even though Mega Clefable itself is Generation IX-DLC-only
  content. That earlier pass's own documentation already named this exact
  gap ("do not invent form introduction data... otherwise keep the
  existing historical-support honesty warning") — this audit gives it a
  concrete, confirmed real-world example, not a new bug. Not fixed in
  this audit (out of scope — Build UX/validation changes were explicitly
  excluded from this pass).
- Not verified against Cloud DEV (no Cloud DEV access was used, per
  instruction). Since both the correct classification and the id-drift
  finding are properties of the upstream PokéAPI dataset/pipeline, not the
  Raspberry Pi environment specifically, a Cloud DEV ingestion using the
  same pipeline would be expected to show the same 99 rows and the same
  drift — inferred, not confirmed.

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
all, only `en`, and critically, **every** ability has an English one (0 of 313 are missing both).
Phase 1C.1 had the web UI fall back to "no description available" in Spanish rather than show the
English effect mislabeled as Spanish; Phase 1C.2b reversed that (an explicit owner decision, not a
bug fix) once the "zero missing both" fact made the tradeoff clear: the Spanish UI now shows the
English effect text with a small, honest "English" tag next to it
(`apps/web/src/components/pokemon/ability-list.tsx`'s `descriptionIsFallback`) rather than
withholding a real description the user could otherwise read. "No description available" is now
reserved for the (currently non-existent, but structurally still possible) case where neither
language has one. This is a real, current upstream gap, not a transient one — a future improvement
here would need either a different/supplementary source for Spanish ability effect text or a
hand-authored translation table, not a PokéAPI fallback field
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

### Phase 1A decision: no sprite/artwork source yet (Explore/Pokédex)

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

### Milestone 2 decision: PokéAPI sprites, PROVISIONAL / dev-only (Build roster)

Build's team roster (`apps/web/src/lib/pokemon-sprite.ts`) now renders real
Pokémon sprites from PokéAPI's `sprites` GitHub repository
(`raw.githubusercontent.com/PokeAPI/sprites`), by explicit owner decision
(2026-09-15), so the Build set-editor UX could be built and visually
reviewed without a placeholder standing in for every roster slot. This is
**not** the same thing as the Phase 1A sprite review above, and does not
supersede it:

- **PROVISIONAL / RIGHTS REVIEW REQUIRED** — approved only as the local/dev
  visual-prototyping source for this pass, not cleared for production use.
- Pokémon sprite images remain third-party IP (Nintendo / Game Freak / The
  Pokémon Company) regardless of the hosting repository's own (permissive,
  code-focused) license — hosting on GitHub or being freely downloadable
  does not grant PokeStudio commercial rights to the underlying artwork.
- These assets are **not to be deployed to production** as part of this
  pass. Shipping them to real users is a separate licensing decision the
  owner has not made yet.
- Coverage/architecture/fallback behavior: see `pokemon-sprite.ts`'s own doc
  comment — default forms only (species' national Dex number = PokéAPI's
  base `pokemon` resource id), non-default forms fall back to the existing
  `art-slot.tsx` placeholder honestly rather than guessing a wrong image.

### Sprite Lab evaluation: PokéSprite (candidate visual source, PROVISIONAL / dev-only)

A dev-only Sprite Lab (`/[locale]/dev/sprites`, not reachable in a production
build, no nav/sitemap entry — see `pokemon-sprite.ts` and
`sprite-coverage-audit.ts`) evaluates PokéSprite's box-style icons
(`github.com/msikma/pokesprite`) alongside the existing PokéAPI sources,
because the owner likes its visual direction. Recorded here for the same
reason the PokéAPI entry above is:

- **candidate visual source, PROVISIONAL / EVALUATION ONLY** — not approved
  for production or commercial use, and not more "rights-cleared" than any
  other third-party-hosted Pokémon image source.
- The underlying imagery is third-party Pokémon character IP (Nintendo /
  Game Freak / The Pokémon Company) regardless of PokéSprite's own
  (permissive, code/data-focused) repository license. Hosting the files on
  GitHub, or that repository having an open-source license for its own code,
  does **not** grant PokeStudio rights to the Pokémon artwork itself — same
  principle as the PokéAPI sprites entry above, not a weaker one.
- **Audited coverage (2026-09-16)**, against this project's own
  `species`/`pokemon_form` tables and PokéSprite's public `data/pokemon.json`
  - `pokemon-gen8/regular/` file listing: covers National Dex 1-905 only —
    **zero Generation IX coverage** (must not be assumed complete for the
    current Pokédex) — and 853/1025 (~83%) of default forms by exact slug
    match within that range (172 gaps, mostly default-form slugs PokéSprite
    names differently, e.g. `deoxys-normal`, `unown-a` — not true
    unavailability, just an unmatched name this audit does not attempt to
    alias). See `sprite-coverage-audit.ts`'s `POKESPRITE_AUDIT_SNAPSHOT` for
    the exact numbers and methodology.
- Real per-form coverage where it does have an entry (regional forms, Rotom
  formes, etc. each have their own file) — broader form coverage than the
  existing PokéAPI "modern" strategy, which is default-form only.
- Do not use as the _sole_ production sprite source until Generation IX
  coverage is resolved (either PokéSprite adds it upstream, or a documented
  fallback chain to another source is decided) — see the Sprite Lab's own
  final-report recommendation for the current thinking.

### Sprite Lab evaluation: Pokémon Showdown / Smogon sprites (candidate, PROVISIONAL / dev-only — stricter rights caveat)

Added to the Sprite Lab as Option D per explicit owner request. This is a
**separate provenance question from the "Pokémon Showdown server/simulator
data" entry above** — that entry is about the MIT-licensed simulator
_code_ (`smogon/pokemon-showdown`); the sprite _images_ live entirely
outside that repository.

- **Repository fact, verified 2026-09-16**: the client repository
  (`smogon/pokemon-showdown-client`, AGPL-3.0) explicitly
  `.gitignore`s `/play.pokemonshowdown.com/sprites/` — the sprite files
  actually served from `play.pokemonshowdown.com` are **not** part of the
  public, version-controlled, licensed source repository at all. There is
  no LICENSE file scoped to these image assets specifically — a less
  documented provenance trail than PokéAPI's or PokéSprite's own sprite
  repos (both of which at least commit the image files to a public git
  history under a stated repository license, even though — as with every
  source here — that license never covers the Pokémon artwork itself).
- **A. Official Pokémon-origin sprites**: the static "gen5"-style sprites
  are extracted/derived from the actual in-game Generation V battle
  sprites — Nintendo/Game Freak-origin image data, same IP status as every
  other source on this page.
- **B. Community-created sprites**: the _animated_ versions of these
  sprites are a credited community project. The project's own governing
  thread (Smogon Forums, "XY Battle Sprite Animations") states explicitly:
  - _"These sprites are free for non-profit use. You must make a credit
    page and link back to this thread."_
  - _"These sprites are not open source, because we do not have the
    rights to the characters depicted."_
  - _"Any games that charge money will not be accepted as a rule."_
  - Individual spriters' permission is required for uses beyond Pokémon
    Showdown/Smogon itself.
- **C. Repository/code licensing**: irrelevant to the sprites themselves,
  since (per the `.gitignore` fact above) the sprite assets are not part of
  the licensed code repository in the first place.
- **Classification for PokeStudio: reasonable provisional dev source,
  UNSUITABLE for commercial production as currently sourced.** The
  community sprite project's own stated terms explicitly rule out
  for-profit use (_"any games that charge money will not be accepted"_) —
  a stronger, explicit restriction than the other three sources' merely
  _undetermined_ commercial status. Do not ship these to production
  without direct outreach to the sprite project for permission, regardless
  of how the PokéSprite/PokéAPI question resolves.
- **Audited coverage (2026-09-16)**, against this project's own
  `species` table, HEAD-checking `sprites/gen5/{formSlug}.png`: 927/1025
  (~90%) default forms, including **85/120 (~71%) Generation IX species**
  — notably better Gen IX coverage than PokéSprite's zero, though still not
  complete. A sampled (not exhaustive) check found 170/200 non-default
  forms and 53/61 (stratified sample) animated sprites. See
  `sprite-coverage-audit.ts`'s `SHOWDOWN_AUDIT_SNAPSHOT` for the exact
  numbers and methodology. Naming mostly follows this project's own
  hyphenated `formSlug` convention (`rotom-wash`, `unown-a`) but not
  universally (`charizard-megax`, no hyphen before the X/Y suffix, unlike
  `charizard-mega-x`) — the same category of gap as PokéSprite's, not
  fixed with a per-species alias table here either.
