# ADR-0013: Moves + learnsets schema (Phase 1C.2)

- Status: Accepted
- Date: 2026-09-12

## Context

ADR-0010 deferred moves, learnsets, version/game context and machine (TM/HM/TR) identity until a
real Phase 1 feature needed them ("Moves, abilities, items and evolutions are their own entities...
never duplicated inline"). Phase 1C.2 is that feature: Explore's Pokémon detail page needs a Moves
section, and moves need their own first-class Explore page for SEO and human utility. This is not
"add a move table and print a list" — the schema must be able to answer, per form, per game context:
can this Pokémon learn this move, by what method, at what level, and (for TMs/HMs) as which machine.

Before designing anything, the real PokéAPI shapes were audited directly (both the ~1351 pokemon
files already cached from Phase 1B/1C.1, and live fetches of `/move`, `/version-group`,
`/move-learn-method`, `/machine`) rather than assumed from memory. Findings that shaped the schema:

- Moves are a per-**variety** (`pokemon`) attribute in PokéAPI, exactly like abilities — every
  cosmetic sub-form under one variety shares its variety's moveset. `pokemon_form_move` follows the
  same per-form join precedent `pokemon_form_ability` already established (ADR-0011 decision 1):
  one row per form, even when many cosmetic forms share an identical moveset. This is a deliberate,
  documented consequence, not an oversight — see "Scale" below.
- **Learn methods**: 12 live values (`level-up`, `machine`, `egg`, `tutor`, `form-change`,
  `stadium-surfing-pikachu`, `light-ball-egg`, `colosseum-purification`, `xd-shadow`,
  `xd-purification`, `zygarde-cube`, `train`) — a real, mostly-historical/event-driven set, not
  hand-picked.
- **The natural key must include `level`.** Auditing the full cached dataset found 9,437 real cases
  where the identical `(pokemon, move, version_group, method)` combination occurs at _two different
  levels_ — e.g. Aromatisse learns Odor Sleuth at level 1 (inherited on evolution) _and_ level 8
  naturally in the same game. Collapsing on `(form, move, version_group, method)` alone would
  silently drop a genuine relearn-move fact. `pokemon_form_move`'s unique key is therefore
  `(pokemon_form_id, move_id, version_group_id, learn_method, level)`.
- **Moves have no Spanish effect text** — `effect_entries` was never observed to contain an `es`
  entry for any move sampled, the same gap `ability.effect_es` already documents (DATA_SOURCES.md).
  Spanish move _names_, unlike effects, are reliably present.
- **Machine identity is cheap to add.** A move's own detail response already embeds every
  `{machine url, version_group}` pair it appears in — the only extra fetch needed is each _unique_
  referenced `/machine/{id}` resource (to resolve the item slug, e.g. `"tm34"`), not PokéAPI's full
  live `/machine` list (2372 records, most irrelevant to any move actually ingested).

## Decision

### 1. Five new tables, following ADR-0010/0011's existing shape

- **`move`** — canonical, one row per real move (~937), identity-upserted by `(source_id,
external_id)` exactly like `ability`/`species`.
- **`version_group`** — small reference table (~32 rows: PokéAPI's `version_group`, the
  game-context granularity learnsets/machines are scoped to), identity-upserted. Carries
  `generation` and PokéAPI's own `display_order` so the app can pick "the latest version group"
  without hardcoding a slug.
- **`move_learn_method`** — small reference table (~12 rows), `slug` as its own primary key (no
  synthetic uuid needed at this size), identity-upserted. **No name/label columns** — unlike
  `version_group`, this table exists purely to give `pokemon_form_move.learn_method` real FK
  integrity ("known methods only" is a hard requirement here, unlike the open-ended
  `species_evolution.trigger`); localized UI labels live in `packages/i18n`, never the database
  (an explicit Phase 1C.2 requirement). A reference table was chosen over a CHECK constraint
  specifically so a future 13th method PokéAPI introduces is picked up by the next ingestion run
  automatically, not by a migration.
- **`pokemon_form_move`** — the core relation: `(pokemon_form_id, move_id, version_group_id,
learn_method, level)` unique, plus `sort_order` (PokéAPI's per-entry teaching-order hint). No
  independent external id — `version_group_details` entries are array positions upstream, not
  addressable resources, so ingestion fully replaces a form's rows per run, same idempotency
  strategy as `pokemon_form_ability`/`species_evolution` (ADR-0011 decision 3).
- **`machine`** — minimal TM/HM/TR identity: `(move_id, version_group_id) → item_slug`. Deliberately
  does not model item detail (sprite, TM/HM/TR category, description, full name) — only the raw
  item slug PokéAPI gives (`"tm34"`), preserved for a future item table to join against without
  losing anything this migration wrote (task §7's explicit allowance to keep this minimal).

### 2. `type`/`damage_class`/`target` stay free text, not new lookup tables

Consistent with `species_evolution.trigger`'s precedent: `move.type` reuses the same 18-value
domain `pokemon_form.types` already uses (no DB-level type table exists for that either — this
migration doesn't invent one just for moves), validated at the ingestion layer
(`packages/pokemon-data/src/validate.ts`) against the same `KNOWN_TYPES` set. `damage_class` _is_ a
CHECK constraint (`physical`/`special`/`status`) — a genuinely closed, stable domain (unchanged
since Generation IV), the "constrained enum-like domain" case the ponytail rule prefers over a
table when nothing else needs to reference it. `target` stays free text for the same open-vocabulary
reason as `trigger`.

### 3. Scale is real and was estimated before building, not discovered after

Auditing the full cached dataset found ~638k `(pokemon, move, version_group, method, level)` rows at
the _variety_ grain (1351 varieties); expanding to the form grain (1579 forms, cosmetic sub-forms
duplicating their variety's rows — same precedent as abilities) gives an estimated **~740k-750k
rows** for `pokemon_form_move`. This is the largest table in the schema by a wide margin (evolution
edges: 553; form/ability links: 3369) but is not a scale problem for Postgres itself — the real cost
is ingestion-side: a larger batch size (2000 rows/insert vs. the existing 500) keeps round-trips
reasonable, and a standalone index on `version_group_id` (beyond the composite
`(move_id, version_group_id)`/`(pokemon_form_id, version_group_id)` indexes) supports "does this
version group have any data at all" queries (`getDefaultVersionGroup`) without a sequential scan.

**Why full per-form duplication was still chosen over a "representative variety" indirection**: the
task explicitly requires `pokemon_form ↔ move` (not `species ↔ move`) because legality can differ by
form; introducing a second indirection layer just to deduplicate identical cosmetic-form rows would
be new architecture solving a problem Postgres doesn't actually have (hundreds of thousands of rows
is routine, not a scale ceiling) — the smaller correct solution is to accept the duplication and pay
for it only where it matters (batch size, indexing), not to build around it.

### 4. Default version group, not a version selector, for the MVP UI

The Pokémon detail Moves section and the move detail page's "Pokémon that can learn this" list both
scope to a single, dynamically-computed "default version group" — the newest-generation version
group that actually has `pokemon_form_move` rows (`getDefaultVersionGroup`), not simply the
newest `version_group` row: a few announced/DLC version groups in the reference table can have zero
learnset rows if PokéAPI hasn't published per-Pokémon data for them yet, and defaulting to one of
those would show a misleadingly empty Moves section. A compact version-group selector (task §15's
explicit alternative) is deferred — this phase never silently merges historical learnsets across
games (every query is explicitly scoped to one version group), it just doesn't yet let a user pick
a different one.

## Consequences

- `packages/pokemon-data` gains three new fetch phases (moves, version groups, learn methods) plus
  a fourth derived one (unique referenced machines), following the exact same "flat, globally
  bounded concurrency, fetch once per unique URL" shape Phase 1B established for abilities/evolution
  chains (`packages/pokemon-data/src/pipeline.ts`).
- `packages/database/src/queries.ts` gains a move/learnset query layer
  (`getMoveBySlug`, `getFormLearnset`, `getDefaultVersionGroup`, `listMovesPage`,
  `getMoveLearners`) — deliberately a new `MoveLearnerItem` shape rather than reusing
  `SpeciesFormSummary`, because a "Pokémon that learns this move" link must point at the _species_
  slug (the Pokémon detail route's key), not a non-default form's own slug.
- Known limitations (documented, not silently claimed as solved): `move.power`/`accuracy`/`pp` store
  only the _current_ value — PokéAPI's `past_values` (historical per-generation changes, e.g.
  Thunderbolt's power was 95 before Generation VI) are not modeled; a move detail page always shows
  today's mechanics, not "as of generation N." Event-only/Home-transfer-only moves are not
  distinguished from ordinarily-learnable ones — PokéAPI's `moves[]` array doesn't reliably flag
  this distinction, so `pokemon_form_move` cannot yet answer "is this move _legally_ available right
  now" with full competitive rigor, only "does this source say this Pokémon can learn this move, by
  this method, in this game." Team Builder-grade legality validation will need to layer additional
  rules (format/regulation, Home transfer restrictions) on top of this data, not replace it.

## Full-dataset ingestion addendum — two real findings the 3-move sample couldn't surface

A first full ingestion run against the live 937-move roster failed 146 moves at the normalization
step (nothing was written — validate-before-persist held), both genuine upstream findings, not bugs
in the audit above:

- **36 moves** (18 signature Z-Moves × physical/special variants, e.g. `breakneck-blitz--physical`)
  have a double-dash in their PokéAPI name — a real modeling quirk (PokéAPI splits a Z-Move whose
  power depends on its base move's category into two records sharing one display name), not two
  separately-named in-game moves. Fixed by collapsing consecutive dashes to one during
  normalization (`sanitizeMoveSlug` in `packages/pokemon-data/src/normalize.ts`) rather than
  loosening the shared kebab-case slug rule every other entity also uses.
- **110 moves** (mostly very recent Generation IX moves — `ivy-cudgel`, `population-bomb`,
  `hydro-steam` — and several id-10000+ placeholder moves for an unreleased game) have no `meta`
  block at all upstream yet. Originally modeled as NOT NULL on the (reasonable but incomplete)
  assumption from the 3-move sample that `meta` is always present. Fixed by making `move.ailment`/
  `move.category` nullable (migration `20260912144000_move_meta_nullable.sql`) and having
  `normalizeMove` leave them `undefined` — never a guessed `"none"`/`"damage"` — when `meta` is
  absent; the numeric modifier fields (`drain`, `crit_rate`, etc.) still default to 0 in that case,
  since "no known secondary effect" is a reasonable domain default for those specifically, not
  invented data.

Both fixes follow the same pattern ADR-0010/0011 already established for classify.ts's full-scale
findings (Rotom, Xerneas): a small sample proves the _shape_ of the model; full-scale ingestion is
what proves — or corrects — its edge-case assumptions. A second run after both fixes ingested
cleanly with zero normalization failures (919 moves, 693,197 learnset entries, 0 validation
issues), and a third identical run proved idempotency (byte-identical row counts).

## Post-ingestion finding — "has any row" was too weak a signal for the default version group

Manually verifying the Pokémon detail Moves section against the live data surfaced a fourth issue,
this time in `getDefaultVersionGroup` itself, not ingestion: the live PokéAPI `version_group` list
now includes several Generation IX entries beyond the real, fully-populated `scarlet-violet` —
`the-teal-mask`, `the-indigo-disk`, `legends-za`, `mega-dimension`, and `champions` (the last two
apparently newer/less-documented additions upstream) — ordered _after_ `scarlet-violet` by
PokéAPI's own `display_order`. `champions` has 24,339 `pokemon_form_move` rows, satisfying the
original "has at least one row" check, but **every one of them is via the `train` learn method** —
no `level-up`/`machine`/`egg`/`tutor` coverage at all, meaning most individual Pokémon (Bulbasaur,
Ditto included) have zero rows there specifically, and the Moves section rendered "no move data"
for generation 9 even though `scarlet-violet` (62,718 rows, real full-roster coverage across five
methods) was sitting right below it. Fixed by requiring at least one `learn_method = 'level-up'`
row instead of any row at all — every real, playable mainline game has level-up coverage (every
Pokémon learns something at level 1), so this is a strong, simple signal a niche/special mode like
`champions` doesn't satisfy. Caught by manually spot-checking the rendered Pokémon detail page
against real data, not by a unit test with synthetic fixtures — a reminder that this class of bug
(a heuristic that's locally correct but wrong against the live version-group ordering) needed the
real dataset to surface at all.
