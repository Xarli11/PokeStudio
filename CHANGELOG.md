# Changelog

All notable PokeStudio changes should be recorded here.

Use human-readable entries. Do not dump every commit.

## Unreleased

### Build → Damage Lab integration (2026-09-22)

A configured Team Builder set now feeds Damage Lab directly: "Test damage"/"Probar daño" on the
open Set Editor links to `/battle/damage?team=<id>&member=<id>`, which imports that member's game,
identity, level, EVs/IVs, ability, item, nature and Tera Type as the attacker (Terastallize itself
stays off until the user opts in) and auto-selects the set's first legal damaging move. The import
is one-way and one-time per visit — Damage Lab never writes back to the team, and a later manual
edit is never overwritten. A discreet banner names the source team/Pokémon with a link back; an
unreachable team or removed member degrades to a small inline note, Damage Lab staying fully
usable either way. Team/member ids are opaque local references only, resolved entirely client-side
through the existing `loadTeamDraft()` boundary — no server round trip, no new payload on normal
Damage Lab visits. Also fixes a general bug where switching locale dropped the current page's query
string (Compare's `?pokemon=`, and now this import link too).

### Battle Lab — Advanced Damage Lab (2026-09-22)

Damage Lab grows from a fixed-assumption calculator into a genuinely competitive tool via
progressive disclosure: each side (Attacker/Defender) gets an independent, collapsed-by-default
Advanced panel — level, nature, ability, item, EVs/IVs, Tera, critical hit (attacker only) — gated
entirely through the existing Build game-capability model, so a Gen I matchup never shows a modern
EV/IV editor it can't back. Simple Mode is unchanged; its fixed assumptions are now just the
Advanced panel's own defaults, so both modes share one calculation path and one Server Action
contract. A new searchable item picker (mirroring the Move Picker) replaces what would otherwise be
a bare `<select>` over ~175 items. Advanced's own reference data (natures/items) loads only once a
panel is actually opened, never inflating the page's initial payload. A visible result is clearly
marked "Inputs changed" the instant any input it depended on changes, instead of silently going
stale.

### Final brand and public domain (2026-09-20)

- Confirm **PokeStudio** as the brand and **https://pokestudio.pro** as its public SEO origin.
- Share the origin across metadata and sitemap; publish absolute robots sitemap discovery,
  homepage canonicals and explicit Open Graph URLs for public pages in both locales.
- Preserve Cloud DEV's `pokestudio` Worker, stable identifiers and ingestion/release policy.
  DNS, custom-domain activation and production remain separate from this code change.

### Guarded CI/CD (prepared for review)

- Reuse full validation for PRs and deliveries, with isolated database integration tests.
- Add serialized Cloud DEV delivery and explicitly approved production promotion with target guards, conditional ingestion, integrity checks and deployed-SHA smoke.
- Document the Cloudflare ownership handover and GitHub Environment/branch configuration; delivery remains disabled pending activation.

### Milestone 2 — Explore Pro & Build v1 (2026-09-14)

Two product pillars advanced together on one shared data foundation: Explore gains filters/sort
and a Compare page; Build ships a first, honest team editor with local persistence. Battle Lab, AI
and auth remain explicitly out of scope.

- **Shared data foundation** (Stage 2.0): new `nature` (25 rows) and `item` (175 holdable items —
  filtered via PokéAPI's own `/item-attribute/holdable` index, not string heuristics) tables,
  ingested from the same pipeline as everything else (`packages/pokemon-data`). A canonical 18-type
  effectiveness chart (`packages/pokemon-data/src/type-chart.ts`) and exact Gen III+ stat formulas
  (`packages/damage/src/stats.ts`, HP/non-HP/Shedinja, hand-verified against known values) live as
  plain domain code, not ingested data — they never change. Species generation is derived from
  National Dex ranges (`species-generation.ts`), not a re-added schema column.
- **Explore Pro** (`/[locale]/pokemon`): Type + Generation filters and 8-way sort (Dex/name/BST/each
  base stat, asc/desc), composing correctly with search and each other. New **Compare**
  (`/[locale]/compare`, 2-4 Pokémon _or forms_ — Meowth vs. Alolan Meowth compare as genuinely
  distinct entries via each form's own stable slug, not just the species) with base stats, types,
  abilities, and each form's real defensive type matchups (4×/2×/0.5×/0.25×/immune) side by side —
  no fake "winner" labels. URL query state (`?pokemon=slug1,slug2`) is the only persisted state; the
  sitemap lists only the query-less shell, never one entry per comparison.
- **Build v1** (`/[locale]/build`): a `TeamDraft` domain model (`apps/web/src/lib/team-draft.ts`) —
  up to 6 members, each with nickname/level/ability/item/Tera type/nature/EVs/IVs/up to 4 moves,
  every identity field a stable slug. Persisted entirely to `localStorage`
  (`team-storage.ts`, schema-versioned, corrupt/old state discarded rather than crashing) — no
  Supabase team tables yet. The set editor constrains ability choices to the selected form's real
  abilities and moves to what that form can actually learn in the selected game
  (`pokemon_form_move`, reusing the same learnset query the Pokémon detail page already uses) —
  labeled honestly as "can learn in this game," never "fully legal team." Team analysis shows a
  defensive type-based profile (weak/resist/immune counts, ability immunities excluded and labeled
  as such), offensive type-only coverage from damaging moves, and Incomplete/Warning/Invalid team
  warnings (`team-analysis.ts`) — distinct severities, not one meaningless score. Reference data
  reaches the client editor via a Server Action (`build/actions.ts`), since the roster lives in
  `localStorage`, not the URL, unlike Compare.
- **Persistent shell nav**: Build is now a real, linked destination (was reserved/unlinked);
  current-section detection switched from a hardcoded constant to real `usePathname()`-based
  detection now that there's more than one real section to distinguish.
- Fixed a real bundling bug found while wiring Explore's filter UI: `@pokestudio/pokemon-data`'s
  barrel re-exported Node-only ingestion internals (`node:fs/promises` via its file cache), which
  broke the client bundle the moment a client component needed a real (non-type) value from the
  package. The barrel now only exports pure domain code; ingestion scripts already imported their
  pieces directly and were unaffected.

### Milestone 2 — Build final product shape pass (2026-09-15)

Final human-review pass on Build before the Milestone 2 commit — reverses the temporary
Scarlet/Violet-only restriction and closes the gap between "no known errors" and "proven valid."

- **All-generation Build**: every historical game/version-group PokeStudio has data for is now
  selectable (grouped by generation), not just Scarlet/Violet. A new central capability model
  (`apps/web/src/lib/build-game-capabilities.ts`, `BuildGameCapabilities`) resolves what actually
  applies per game — abilities/natures/held items/modern EV-IV stats/Tera/Dynamax/Mega
  Evolution/Z-Moves/special rulesets (Let's Go, Legends: Arceus) — instead of scattered
  `if (versionGroupSlug === 'x')` checks. The Set Editor now hides mechanics that don't exist for
  the selected game rather than showing them universally, and never computes Gen III+ stat formulas
  for a game they don't apply to (Gen I/II, special-ruleset games) — an honest omission, not a wrong
  number. A team's status can no longer read VALID for a game whose ruleset PokeStudio hasn't fully
  validated yet (new `unsupportedRuleset` team warning); "My Teams" status badges reflect the same
  honesty.
- **Problems vs. Team Analysis**: split into two distinct surfaces (`problems-panel.tsx`) —
  "what do I need to fix" vs. "how does this team behave strategically." "View all N issues" now
  scrolls to Problems, never to Team Analysis.
- **Add Pokémon no longer auto-opens the Set Editor**: adding a member from the roster picker just
  adds it to the roster: Configure (or Review, for a specific issue) is the explicit way to open its
  set editor, so adding several Pokémon in a row is faster.
- **Roster card redesign**: Configure is a real styled button (not a text link); change-form/remove
  are square, comfortable-hit-area icon buttons with clear icons, tooltips and restrained
  danger-hover styling on remove.
- **Pokémon sprites in the Build roster** (`apps/web/src/lib/pokemon-sprite.ts`): a centralized
  resolver replaces the letter-monogram placeholder for every default-form species, with a subtle
  type-accented background and a graceful fallback for forms it can't map yet. Sprite source is
  PokéAPI's `sprites` GitHub repo, by explicit owner decision — **PROVISIONAL / dev-only, not
  cleared for production/commercial use** (see `docs/engineering/DATA_SOURCES.md`).
- **Human-review correction pass**: "View all N issues" now reserves scroll offset
  (`scroll-mt-28`) so the Problems heading and first rows clear the sticky app header. Roster
  sprites now fill their whole fixed viewport (`object-contain`, no inner sub-box), for more
  consistent visual presence across species without any per-species scaling. Species availability
  is now generation-aware: a member whose species debuted after the selected game's own generation
  (reusing the existing National Dex → generation ranges, not a new table) is flagged INVALID —
  `{name} is not available in {game}` — never silently removed, and clears automatically switching
  back to a compatible game. `BuildGameCapabilities` gained `teamAnalysisSupported` (true from
  Generation VI onward, when the modern 18-type/Fairy chart is historically accurate): Team
  Analysis renders a restrained honest message instead of the modern Defensive/Offensive breakdown
  for earlier generations, without affecting team validity — a separate axis from legality.
- **Dev-only Sprite Lab** (`/[locale]/dev/sprites` — 404s in production, no nav/sitemap entry):
  compares three candidate roster-sprite strategies (`pokemon-sprite.ts`'s `SpriteStrategy` —
  `'box'`/PokéSprite, `'game-era'`/PokéAPI per-game sprite sets, `'modern'`/PokéAPI's current-Dex
  set) inside the real approved roster card, across 12 representative Pokémon chosen to include
  known rough edges (a Gen IX species, a non-default form, two documented PokéSprite naming gaps),
  plus a live + audited coverage report (`sprite-coverage-audit.ts`). PokéSprite is a second
  candidate visual source, evaluated the owner's preferred box-icon direction — audited to cover
  National Dex 1-905 only (**zero Generation IX coverage**); PokéAPI's per-game sprite sets only
  exist for the specific games verified against `github.com/PokeAPI/sprites` (several requested
  games, e.g. Sword/Shield and Sun/Moon, have no separate folder and are left unmapped rather than
  silently substituted). Production Build roster behavior is unchanged — the Lab is purely
  additive, pending an owner decision from its comparison.
- **Sprite Lab Option D: Pokémon Showdown / Smogon** (`pokemon-sprite.ts`'s `'showdown'`
  strategy) — static "gen5"-style sprites, audited at 927/1025 default forms including 85/120
  Generation IX species (better Gen IX coverage than PokéSprite's zero). Rights status is
  **stricter** than the other three sources: the sprite files aren't even part of the public,
  licensed `pokemon-showdown-client` repository (explicitly `.gitignore`d), and the community
  animation project's own stated terms explicitly rule out commercial/for-profit use — see
  `docs/engineering/DATA_SOURCES.md`.
- **Mega-form audit, corrected same day**: an initial audit incorrectly classified 49 of 99
  "mega"-slugged `pokemon_form` rows as non-canonical fan content. A deeper re-audit (prompted by
  owner pushback) confirmed all 99 are official, current Pokémon content — 50 classic Mega
  Evolutions (X/Y, ORAS) plus 49 introduced by Pokémon Legends: Z-A (2025) and its Mega Dimension
  DLC, including a new official "Z Mega Evolution" mechanic. No data change needed. A real,
  separate issue found in the same audit: PokéAPI's non-default-form numeric ids have drifted
  since our last ingestion (~554/1579 forms affected) — a real idempotency risk for the next
  ingestion, not a Pokédex-correctness problem today. See `docs/engineering/DATA_SOURCES.md`'s
  "Classification findings" section (marked RESOLVED, with the correction left visible) for the
  full record.
- **Correction (2026-09-16, follow-up branch): the "external_id drift" item directly above was
  itself a false alarm** — an audit methodology error (comparing PokéAPI's `pokemon` variety
  resource id against this project's `pokemon_form.external_id`, which has always come from the
  distinct `pokemon-form` resource id instead). Re-verified against the correct endpoint: zero
  drift across every example previously cited. A reusable read-only diagnostic
  (`pnpm --filter @pokestudio/pokemon-data diagnose-form-identity`) confirmed 0/1579 Pi rows would
  change on a fresh ingest. No schema or ingestion change was needed or made — see
  `docs/engineering/DATA_SOURCES.md` for the full corrected record.

### Phase 1C.3 — Explore Discovery & Abilities (2026-09-14)

Makes the Pokédex searchable across the whole dataset and promotes abilities to a first-class,
navigable entity, alongside a fix for a real case-insensitive-routing bug this phase surfaced.

- **Whole-Pokédex search** (`/[locale]/pokemon`): instant client-side filtering by English/Spanish
  name, national Dex number (`25`, `025`, `#25` all equivalent), and non-default form names (e.g.
  "Alolan Meowth" resolves to the Meowth species card, never a separate entry — task's species-
  oriented semantics). Measured the whole-dataset search index first (`getSpeciesSearchIndex`,
  packages/database): 1025 species + 554 form aliases, ~95KB JSON / ~19KB gzip — small enough to
  ship whole and filter client-side (`apps/web/src/lib/pokemon-search.ts`), so the decision didn't
  need a server-side search endpoint. The existing paginated server-rendered view is unchanged and
  still what search reverts to when the query is empty.
- **Abilities as a first-class entity**: new `/[locale]/abilities` (instant client search over the
  313-row table, ~12.5KB gzip, same "measure first" reasoning) and `/[locale]/abilities/[slug]`
  (effect text with the existing PokeStudio-owned Spanish fallback chain, and a species-oriented
  "Pokémon with this ability" list — one card per species, naming the specific form only when the
  ability belongs to a non-default form). New query layer: `listAbilities`, `getAbilityBySlug`,
  `getPokemonForAbility` (`packages/database`). Ability names on the Pokémon detail page are now
  real links to their detail page. No `generation` column exists on `ability` upstream — "Generation
  introduced" was deliberately not added rather than inferred (task §15).
- **Case-insensitive canonical entity routes** (`/pokemon/[slug]`, `/moves/[slug]`,
  `/abilities/[slug]`): `/es/pokemon/MEW` now 308-redirects to `/es/pokemon/mew`, etc. This
  surfaced a real bug during implementation: a page-level `redirect()`/`permanentRedirect()` call
  only produces a real HTTP redirect when nothing has streamed yet, and all three routes have a
  `loading.tsx` sibling — the Suspense boundary that creates means Next streams a 200 shell before
  the page's own redirect can commit, so the "redirect" only ever reached non-JS clients (curl,
  crawlers, status-code checks) as a 200 with the redirect instruction buried in the RSC payload.
  Moved the check to `middleware.ts` instead (`apps/web/src/lib/entity-slug.ts`), which runs before
  any rendering and both issues a real top-level 308 and preserves the query string for free.
- **Explore subnav**: Pokémon / Moves / Abilities, rendered from `PersistentShell` — Explore-local,
  not crowding the primary Explore/Build/Battle Lab header nav.
- **Sitemap**: ability index + detail entries added; `apps/web/src/app/sitemap.test.ts` (new)
  proves the URL count formula against live data and that no URL is ever uppercase.
- **i18n**: all new copy in `@pokestudio/i18n` (EN/ES) — Pokémon search, ability search/detail,
  hidden-ability/form-specific labels. No hardcoded UI strings.
- Deliberately deferred: type/generation filters on the Pokédex index (search was the priority);
  fuzzy/typo-tolerant search (substring matching is enough at this scale).

### Raspberry Pi local-development database (2026-09-12)

Establishes a self-hosted Supabase instance on a Raspberry Pi (`192.168.1.236`) as the canonical
local-development database, replacing an ad hoc Mac-local Supabase-CLI stack that a prior session
had incorrectly treated as normal workflow.

- **CLAUDE.md §21** ("Local Development Database — Source of Truth"): normal development never
  runs `supabase start` on the Mac or assumes localhost Postgres/Supabase; the Pi's API gateway
  (`:8002`) serves app/runtime + ingestion, its direct Postgres (`:5434`) serves migrations/admin.
  The deployed Cloudflare Worker DEV environment is unaffected — it keeps using Supabase Cloud.
- **New guarded commands** (root `package.json`, `scripts/`): `pnpm dev:pi`, `db:pi:check`,
  `db:pi:migrate` (`supabase db push --db-url`, not linked-project-dependent), `db:pi:types`,
  `ingest:pi` — each refuses to run unless its target env var actually points at the Pi
  (`scripts/db-pi-guard.sh`), so an accidental localhost/other-host operation aborts instead of
  silently doing the wrong thing.
- **Docs**: `docs/engineering/DATABASE.md` gained a "Raspberry Pi local development" section
  (architecture diagram, command/guard table); `README.md`/`packages/database/README.md`/
  `packages/pokemon-data/README.md` now lead with the Pi workflow and relabel the old
  Supabase-CLI flow "Isolated local Supabase (exceptional)" — kept for genuinely disposable test
  instances, never the default. `.env.example` documents `POKESTUDIO_PI_DB_URL` and the Pi-pointed
  values for the existing Supabase variables.
- **Verified against the real Pi**: the one migration Phase 1C.2c had only validated locally
  (`20260912150000_move_stat_change.sql`) was pending on the Pi; `db:pi:migrate` applied it, then
  `ingest:pi` ran the full pipeline (0 validation issues, 245 `move_stat_change` rows) and the
  `persist.integration.test.ts` suite passed against it directly.
- Left unresolved: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`/`SUPABASE_PUBLISHABLE_KEY` are not yet in
  `.env.local` — deliberately not fetched/written this session (never handle secrets unasked); the
  app and the RLS/queries integration suites need it added before `dev:pi` can read real data.

### Phase 1C.2b — Explore UX polish + documentation reorganization (2026-09-12)

Part A: closes real UX gaps found by auditing Phase 1C.2 against live data, not speculative polish.

- **Moves**: Pokémon-detail Moves section rewritten as an interactive client table (desktop) /
  card list (mobile) — search, type/damage-class/method filters, sortable Name/Power/Accuracy/PP/
  Level columns (client-side; the per-form/version-group dataset is small and already
  server-fetched once, so no extra round trip). Null power/accuracy/non-level methods render as
  "—", never a misleading `0`. New version-group selector lets a Pokémon's moveset be viewed per
  game generation instead of one hardcoded default. Global `/moves` index now does real
  server/database-backed search+filtering (`listMovesPage` gained `MoveListFilters`) instead of
  client-side filtering of a full dataset; filtered URLs canonicalize to the base `/moves` path and
  are excluded from the sitemap.
- **Fixed a real default-version-group bug**: `getDefaultVersionGroup` picked "any version group
  with a `pokemon_form_move` row," which a niche `champions` version group (24k rows, all via the
  non-mainline `train` method) could outrank the fully-populated `scarlet-violet` on raw
  `display_order`. Now requires at least one `level-up` row — the real "has mainline coverage"
  signal.
- **Abilities**: audited EN/ES coverage first (313/313 EN, 0/313 ES, 0 missing both — confirmed a
  genuine, total upstream gap, not an ingestion bug). Spanish UI now falls back to the English
  description with a visible "English" tag instead of rendering blank; never machine-translated.
- **Base stats**: added quality tiers (low/average/good/excellent, distinct thresholds for Total
  Base Stat) validated against real data before shipping, reusing the existing
  `--color-success/warning/danger` tokens rather than inventing a new palette.
- **Evolutions**: redesigned as one parent fanning out to all of its children (e.g. Eevee →
  Vaporeon/Jolteon/Flareon/...) instead of repeating the parent per evolution edge. Evolution
  condition text is now locale-aware, including a small hand-verified table of classic evolution
  stone names in Spanish (e.g. "Piedra Agua").
- **i18n**: Spanish nav/product-section label for Build changed from the literal verb "Construir"
  to "Equipo" ("Explorar · Equipo · Laboratorio de Combate") to read as a product section name.
- Extensive new unit/component tests for all of the above (stat tiers, version-group labels,
  evolution item labels, moves filtering/sorting, ability fallback, version-group selection).

Part B: reorganizes root documentation now that the schema/UX work is stable — no functional
change.

- Moved 22 root-level docs into `docs/{product,architecture,engineering,community,legal}/`
  alongside the existing `docs/adr/`; removed `MANIFEST.md` and `START_HERE.md` (redundant Phase 0
  bootstrap entry points with no ongoing utility beyond what `CLAUDE.md`/`docs/README.md` now
  cover). Added `docs/README.md` as a compact index. Fixed every cross-reference (Markdown links,
  `CLAUDE.md`, `README.md`, ADRs, package READMEs) to the new paths — verified with a full repo
  scan, zero stray references remaining.
- Fixed stale facts found during the reorg audit: `README.md` claimed the Cloudflare Worker was
  "not deployed yet" (it has been, to a `workers.dev` subdomain); `docs/product/DESIGN_SYSTEM.md`
  referenced the pre-rename `AppShell` component (now `PersistentShell`) in two places.

Part C: final presentation/accessibility polish before freezing 1C.2 — density and hierarchy only,
no new product scope, no data/routing change.

- **All moves games/methods**: replaced an inline `<details>` expansion (which made a row as tall
  as its full game/method list) with a small anchored `PopoverDisclosure` — a move's row height is
  now constant regardless of how many games/methods grant it. Games collapse to the game's own name
  (one game) or "{count} games · Gen. X[–Y]" (more), grouped by generation inside the popover.
  Methods collapse to "{primary method} +{N}" with the full breakdown one click away.
- **Ability presentation**: clearer name hierarchy, a separator between multiple abilities, and
  `leading-relaxed` on long PokeStudio Spanish effect text so it doesn't read as a wall of text.
- **PokeStudio-owned Spanish ability effects, 313/313**: the layer promised (not delivered) in the
  first UX-polish pass — a static, version-controlled `packages/i18n/src/ability-effects-es.ts`
  keyed by ability slug, exact technical mechanics preserved (percentages, stat stages, HP
  thresholds, conditions), verified 313/313 against the live Pi dataset
  (`packages/database/tests/ability-effects-coverage.integration.test.ts`). Fallback chain:
  upstream Spanish (in case PokéAPI ever publishes one) → PokeStudio Spanish → upstream English
  (tagged honestly) → localized "unavailable" message. The "English" fallback tag no longer shows
  once a PokeStudio translation exists.
- Table row density tightened (`py-2` → `py-1.5`); the "All moves" clarifying hint capped to
  `max-w-prose` so it reads as a caption, not a banner.

### Phase 1C.2c — Move mechanics (2026-09-12)

Adds the exact technical mechanics a move causes — the move detail page's "lowers Defense" claims
now say "lowers Defense by 1 stage," backed by real structured data instead of prose guesses.

- **Schema**: new `move_stat_change` table (one row per stat-stage change a move causes, e.g.
  Growl: attack -1) sourced from PokéAPI's `move.stat_changes` — a separate top-level array from
  `move.meta`, never captured until now. Fully replaced per `source_id` per ingestion run, same
  idempotency pattern as `pokemon_form_move`. `move.ailment`/`move.category` made nullable
  (follow-up migration) to stop silently coercing PokéAPI's genuine "no data" gap into a false
  value.
- **Ingestion**: `pokeapi-client`/`normalize`/`validate`/`persist` extended end-to-end for
  `stat_changes` (validated against the real 7-value stat vocabulary: the 6 battle stats plus
  accuracy/evasion, and a -6..6 nonzero stage range).
- **Move detail page**: new "Technical effects" section renders deterministic, localized (EN/ES)
  sentences for every mechanic actually present — stat-stage changes, status ailments (hand-verified
  phrasing for burn/freeze/paralysis/poison/sleep/confusion, honest slug-derived fallback for the
  rest — never machine-translated), flinch chance, drain/recoil, healing, multi-hit and multi-turn
  ranges. Stat-change direction (self vs. target) resolves via a verified rule: `damage-raise`
  category moves always affect the user's own stat even when the move's `target` is the opponent
  (Superpower/Close Combat lower the user's own Attack/Defense); every other category follows the
  move's own `target` field literally. Also added the move's target (localized) and effect chance
  to the stat grid, and a signed-integer priority display (e.g. "+1", "-6").
- Ingested against the local dataset: 919 moves, 245 stat-change rows, 0 validation issues.
- **Polish**: an empty "Description" block no longer renders above real Technical Effects (e.g.
  Stone Edge) — a missing prose description never implied PokeStudio knew nothing about the move,
  but showing it that way did. Technical Effects promoted into its own card, `text-foreground`
  instead of muted, so it reads as the authoritative content it is.

### Phase 1C.2 — Moves + Learnsets (2026-09-12)

Adds a full move + learnset data foundation (ADR-0013) and Explore integration — the schema
foundation legality validation, moveset display, and future move search/SEO all build on.

- **Schema**: 5 new tables (`move`, `version_group`, `move_learn_method`, `pokemon_form_move`,
  `machine`), form-aware (`pokemon_form_move`, not species-level) with a natural key that includes
  `level` — real data has ~9.8k cases of the same form/move/version-group/method at two different
  levels (a genuine relearn mechanic).
- **Ingestion**: extends `packages/pokemon-data` with move/version-group/learn-method/machine
  fetch+normalize+persist phases. Full run: 1025 species, 1579 forms, 919 moves, 32 version groups,
  693,197 learnset rows, 2372 machines, 0 validation issues; a second run proved byte-identical
  idempotency.
- **Real full-scale findings, fixed not papered over**: PokéAPI splits signature Z-Moves into two
  records with a double-dash name; ~110 recent moves have no `meta` block at all (nullable
  `ailment`/`category`, never a guessed default); some status moves encode "no power" as literal
  `0` instead of `null`; a handful of moves carry PokéAPI's non-standard `"shadow"` type
  (Colosseum/XD-exclusive, excluded — PokeStudio's type domain doesn't model it); the "pick the
  latest version group with data" heuristic needed strengthening from "any row" to "any level-up
  row" after a newer, niche-only version group (`champions`) shadowed the real, fully-populated
  `scarlet-violet`. See ADR-0013's addenda for the full account of each.
- **Explore UI**: a restrained Moves section on the Pokémon detail page (scoped to one explicit,
  dynamically-computed default version group — never silently merges historical learnsets),
  first-class `/[locale]/moves` index and `/[locale]/moves/[slug]` detail pages with full SEO
  metadata (canonical, hreflang, sitemap entries for all ~919 moves × 2 locales).
- **i18n**: move/learn-method/damage-class labels added to `packages/i18n` — never stored in the
  database (learn methods) or hardcoded in the app (labels stay swappable per locale).

### Final Brand 1.0 + Styling Foundation audit (2026-09-12)

Pre-commit audit closing out the Styling Foundation 1.0 / UI Polish 1.1 / persistent-shell
body of work — no visual or architectural changes, verification + a few small fixes only.

- **Asset re-export confirmed clean**: every SVG under `apps/web/public/brand/` (11 files)
  audited programmatically for a baked-in full-canvas background rect — the defect flagged
  in the Brand 1.0 entry below is resolved; none remain. Favicon center "holes" confirmed
  as real stroke-only transparency, not an opaque fill.
- **Favicon now size-aware**: `pokestudio-favicon-16.svg` registered in `brand-assets.ts`
  alongside the existing 32px one; `generateMetadata`'s `icons.icon` is now an explicit
  `[{ 16×16 }, { 32×32 }]` array instead of a single untyped icon.
- **`pokestudio-symbol-light.svg` still not registered**, deliberately — see
  `DESIGN_SYSTEM.md` "Logo" section; its background is now transparent, but which of the
  two "Logo – Emerald" Figma variants it is remains unconfirmed.
- Stale doc references to "AppShell" (renamed to `PersistentShell`) corrected in
  `DESIGN_SYSTEM.md`.

### Persistent shell + theme/locale fixes (2026-09-11 – 2026-09-12)

Three follow-on passes after Styling Foundation 1.0, undocumented until now:

- **Theme persistence made locale-independent**: `ThemeToggle` re-resolves from the one
  global `pokestudio-theme` localStorage key (system preference as fallback) on every
  mount instead of trusting `data-theme`'s current DOM value, which a locale switch could
  transiently clear. Fixes theme appearing to "reset" when switching `/es` ↔ `/en`.
- **Locale switcher moved to `next/link`**: was `router.push` from a plain button (correct
  soft navigation already, but no prefetch eligibility); now a styled `<Link>`, keeping the
  `NEXT_LOCALE` cookie write in `onClick`.
- **Persistent shell refactor**: `AppShell` (header, wordmark, primary nav, locale/theme
  controls, `<main>`) moved from being re-instantiated inside every `page.tsx` into
  `[locale]/layout.tsx` as `PersistentShell`, rendered once. Same-locale navigation
  (browsing the Pokédex, opening a Pokémon) no longer unmounts/remounts the header, nav,
  `ThemeToggle`, `LocaleSwitcher`, or footer — only the page content inside `<main>`
  changes. An actual locale change still remounts the shell (a different `[locale]` value
  is a genuinely different layout instance in the App Router — not something to work
  around without changing routing semantics). `contentWidth`/`MAIN_WIDTH_CLASS` machinery
  removed; each page now puts `max-w-text|detail|wide` directly on its own content wrapper.

### UI Polish 1.1 (2026-09-11)

Visual refinement pass on top of the Tailwind foundation — no information-architecture
changes.

- **Navbar**: divider softened to a low-contrast border plus, dark mode only, an
  extremely faint Emerald gradient line (never a flat neon edge); logo↔nav spacing and
  nav-item rhythm separated into two deliberate tiers; EN/ES and the theme toggle became a
  compact segmented-pill control instead of loose ghost-styled text.
- **Home**: redesigned from a single CTA on a mostly-empty page into a hero (title,
  tagline, status, Explore CTA) plus a "Built around three pillars" preview (Explore
  live/linked; Build/Battle Lab flatter with a "Soon" badge) — new
  `home.pillarsTitle`/`home.pillars.*` copy in both locale dictionaries.
- **Pokédex cards**: stronger name/dex-number hierarchy; hover/focus reworked to a
  restrained border + surface-lift + small transform — no colored glow shadow, no scale
  (removed `--ps-shadow-glow` entirely, now unused).
- **Light theme**: card surfaces now carry a whisper of the brand's cool-tinted base
  instead of stark white; dark-mode borders quieted (fewer visibly-boxed edges).
- **Primary CTA fixed at the semantic level**: introduced `--ps-color-brand-action` /
  `-hover`, a filled-button-surface role distinct from `--ps-color-primary`'s text/icon
  role (which is deliberately deepened in light mode for AA text contrast — wrong tone for
  a button fill). Also fixed a real bug found in the process: `a { color: inherit }` in
  `globals.css` was unlayered, so it silently beat every `.text-*` Tailwind utility on
  anchor-rendered buttons regardless of specificity — moved PokeStudio's base rules into
  `@layer base` so utilities correctly win again.

### Styling Foundation 1.0 — Tailwind CSS 4 migration (2026-09-11)

Adopts Tailwind CSS 4 as PokeStudio's primary styling system (`apps/web`), replacing CSS
Modules and inline `style={{}}` objects across every currently-shipped page/component.
PokeStudio's own semantic design tokens (`packages/ui/src/tokens.css`) remain the single
source of truth — Tailwind consumes them via one `@theme` block (`--color-surface`,
`--color-brand`, `--radius-md`, `--shadow-sm`, `--breakpoint-sm/md/lg/xl`, etc., each a
`var()` alias onto an existing `--ps-*` token, never a duplicated value), so `bg-surface`,
`text-muted`, `rounded-lg` and friends resolve through the exact same dark/light cascade
the app already had.

- **Checkpoint A (parity)**: AppShell/navbar, locale/theme controls, home, not-found,
  global-error, the Pokédex index + pagination, the Pokémon detail page, and every
  `pokemon/*` component (card, type badge, stat bars, ability list, art slot, form
  section, evolution section) migrated to Tailwind utility classes.
- **Checkpoint B (polish)**: AppShell navbar recomposed as one desktop row (logo → nav →
  controls, ≥1200px) via flex `order`/`basis` instead of CSS Grid areas — no visual
  regression, smaller diff. Divider softened to `border-border-subtle`. Wordmark height
  now steps 28px → 32px → 44px across the shared breakpoint scale.
- **CSS Modules removed**: all 4 (`app-shell`, `pokemon-grid`, `form-section`,
  `evolution-section`) — none met the "keep only for a concrete technical reason" bar.
  **0 `.module.css` files remain.**
- **New shared primitives**: `apps/web/src/lib/ui-classes.ts` (`buttonClass`, `cardClass`,
  `interactiveCardClass`, `tagClass`, `eyebrowClass` — class-string helpers, since call
  sites render different elements for the same look) and
  `apps/web/src/components/ui/skeleton.tsx`, replacing the old global `.ps-btn` /
  `.ps-card` / `.ps-tag` / `.ps-eyebrow` / `.ps-skeleton` / `.ps-disclosure-summary`
  classes (all removed from `globals.css`).
- **Dead tokens removed**: `--ps-space-1..8` (Tailwind's own dynamic spacing scale already
  reproduces the same 0.25rem grid) and `--ps-radius-pill` (identical to Tailwind's
  built-in `rounded-full`).
- **Per-type dynamic styling kept as inline `style`, deliberately**: `PokemonTypeBadge`,
  `PokemonArtSlot`, the stat-bar fill gradient, and the card's type-accent border all pick
  a CSS custom property at runtime from Pokémon data — a static Tailwind class can't
  express that, so these stay `style={{ ... color-mix(..., var(--ps-type-x), ...) }}`,
  still 100% token-driven (never a hardcoded hex).
- **Dependencies**: added `tailwindcss` + `@tailwindcss/postcss` (`apps/web`, dev). Nothing
  removed — there was no prior styling library to retire (CSS Modules are a Next.js
  built-in, not a package).
- Product/data behavior, Supabase, the battle/damage engines and Cloudflare deploy
  architecture are untouched.

### Brand 1.0 — Final Figma Integration (2026-09-11)

Wires the official Figma-exported logo assets into the product, replacing the interim
text-only wordmark from the earlier Brand Integration 1.0 pass.

- **Official assets**: 10 SVG exports (of 11 named in the brief) added under
  `apps/web/public/brand/`, referenced via a small registry
  (`apps/web/src/lib/brand-assets.ts`) — never redrawn or recolored in code.
- **AppShell**: header now renders the real wordmark SVG (`pokestudio-wordmark-on-dark.svg`
  / `-on-light.svg`), theme-switched with pure CSS off the existing `data-theme` attribute
  — no client JS, no hydration risk, no flash of the wrong variant.
- **Favicon**: replaced the provisional placeholder (`apps/web/public/icon.svg`, removed)
  with the official `pokestudio-favicon-32.svg`.
- **Contrast/hue verified, not assumed**: Deep Green on Light measures 5.07:1, Emerald on
  Charcoal 7.70:1 (both AA-clear); brand hue (~158–163°) confirmed distinct from
  `--ps-type-grass` (128°) and `--ps-type-bug` (72°).
- **Known asset issue, flagged not fixed**: every non-favicon export has an opaque
  full-canvas background baked in rather than a transparent one, and two Figma variants
  ("Logo – Emerald" / "Logo – Emerald White") have no unambiguous matching file — see
  `DESIGN_SYSTEM.md` "Logo" section. Reported for a corrected re-export, not patched here.

### Brand Integration 1.0 (2026-09-11)

Adopts PokeStudio's approved visual identity across the whole product, replacing every
provisional branding experiment. See `DESIGN_SYSTEM.md` for the full spec.

- **Removed**: the temporary Brand Lab exploration page, the rejected Split Core mark,
  the POKE/STUDIO split wordmark, and the Pokepedia-inspired technical subline under the
  header wordmark.
- **Canonical palette**: `packages/ui/src/tokens.css` now derives every neutral/brand
  color from six fixed primitives (Emerald `#10B981`, Mint `#34D399`, Deep Green
  `#047857`, Charcoal `#0A0D0C`, Graphite `#151A18`, Light `#F3F7F5`) instead of scattered
  hex values; light mode is redesigned on its own terms rather than an inverted dark
  theme. Pokémon type-color tokens are unchanged.
- **Typography**: standardized on Inter (Regular/Semibold/Bold), self-hosted via
  `next/font` — no external font request, no new dependency.
- **AppShell**: header now shows a clean, single-weight "PokeStudio" wordmark with a
  documented integration point for the official logo SVG once it's supplied (not yet in
  the repo — no substitute mark invented).
- **Universal Pokédex numbering**: dex numbers (`#001`, `#133`, …) are now locale-independent
  everywhere, matching the approved identity (previously localized to `N.º` in Spanish).

### Phase 1C.1 — Abilities and evolutions (2026-09-10)

Extends the Pokédex vertical slice with abilities and evolution relationships (ADR-0011) —
**313 abilities, 3369 form/ability links, 553 evolution edges** across the full 1025-species dataset.

- **Abilities schema**: `ability` (canonical — slug, English/Spanish name, English/Spanish effect
  where available, provenance) and `pokemon_form_ability` (join: which ability, which slot, hidden
  or not). One row per real ability, never duplicated per Pokémon — proved against Bulbasaur/Ivysaur/
  Venusaur all sharing one `overgrow` row. Public-read/service-write RLS, same pattern as
  `species`/`pokemon_form`.
- **Evolutions schema**: `species_evolution`, a graph of edges (`from_species_id -> to_species_id`
  plus condition) rather than fixed stage columns — required to represent Eevee's 8-way branch and
  Feebas' two independently valid evolution methods to the same target (max Beauty, or trade
  holding Prism Scale) without hacks. See ADR-0011 for the full rationale (including why the two
  join tables have no independent external identity and are replaced-per-run instead of upserted
  by identity).
- **Ingestion extended, not re-architected**: two new bounded-concurrency fetch phases (unique
  ability URLs, unique evolution-chain URLs — each fetched once regardless of how many
  species/varieties reference it), normalized alongside species/forms, validated (new invariants:
  ability slug/external-id collisions, orphan form/ability and evolution references, self-
  referencing edges), persisted idempotently. A warm-cache full re-run touches the network 0 times
  and reproduces byte-identical row counts.
- **Real data-quality findings** (`pnpm --filter @pokestudio/pokemon-data audit`, DATA_SOURCES.md):
  PokéAPI provides a Spanish ability name for all but 3 of 313 abilities, but a Spanish ability
  _effect_ for **none** of them — every `effect_es` is null, never invented. Evolution
  `evolution_details` also isn't version-group-scoped in this model: some evolutions (Magneton ->
  Magnezone, Eevee -> Leafeon) list the same conceptual "level up in a special location" method
  once per game's location, surfacing as several near-duplicate edges rather than one — the UI
  collapses these for display (edges rendering to an identical description string are deduplicated;
  see `apps/web/src/lib/evolution-condition.ts`) without losing the underlying rows.
- **Explore UI**: each form's card now lists its abilities (hidden ability visually distinguished,
  localized name, concise effect where available, "no description available" rather than a blank
  or an invented one). A new evolution section renders the species' full family as simple
  `[from] → [to] (condition)` rows — supports branching and multiple alternative conditions per
  edge, links every species to its own detail page, no diagramming dependency.
- **Query layer** (`packages/database/src/queries.ts`): `getSpeciesBySlug` now includes each form's
  abilities; new `getEvolutionFamily` resolves a species' whole family via two small indexed
  queries (find any edge touching the species to learn its PokéAPI evolution-chain id, then fetch
  every edge sharing it) rather than a recursive SQL walk or a full-table scan.
- New migrations: `20260910120000_pokemon_abilities.sql`, `20260910130000_pokemon_evolutions.sql`.
  `generated-database-types.ts` regenerated.

### Phase 1B.2 — Cloudflare Workers readiness (2026-09-09)

Prepared `apps/web` to deploy to Cloudflare Workers (ADR-0005) — not deployed yet.

- Evaluated Cloudflare's two current Next.js deployment paths against this actual repo: **vinext**
  (Cloudflare's stated default, but explicitly experimental/AI-built/unreviewed) was tried via
  `npx vinext init` and reverted after it broke `pnpm typecheck` (its generated `vite.config.ts`
  fails under this repo's strict `exactOptionalPropertyTypes`) and showed unmet peer dependencies
  (React 19.2.8 vs. required ^19.3.0). **`@opennextjs/cloudflare`** (the mature, `next build`-adapting
  path) installed and built cleanly with zero peer conflicts and no extra infrastructure — chosen
  instead. Full evaluation in ADR-0005's Phase 1B.2 addendum.
- Added minimal Cloudflare config: `apps/web/wrangler.jsonc` (nodejs_compat, static assets, no
  R2/KV cache, no images binding — none needed yet) and `apps/web/open-next.config.ts` (default,
  no incremental-cache override).
- `apps/web/next.config.mjs` now also calls `initOpenNextCloudflareForDev()`, which makes plain
  `next dev` Cloudflare-binding-aware. `pnpm dev`/`pnpm build` are otherwise unchanged — verified
  both still work exactly as before.
- New scripts (root and `apps/web`): `build:cf`, `preview:cf`, `deploy:cf`.
- Verified end-to-end on the real `workerd` runtime (`preview:cf`, not just `next build`): locale
  middleware redirects, the paginated Supabase-backed Pokédex index, a 6-form Rotom detail page,
  ES regional-form names, `robots.txt`, and a 2054-URL dynamic `sitemap.xml` all served correctly.
- The deployed Worker needs `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` as
  Worker environment variables (never committed) — `SUPABASE_SECRET_KEY` must never be configured
  on it. No deployment performed; no domain connected; no production config added.

### Phase 1B — Full Pokédex ingestion and dataset hardening (2026-09-09)

Replaces the Phase 1A hand-mirrored 3-species sample with a reproducible, idempotent, full-dataset
ingestion pipeline: **1025 species, 1579 forms** — the complete PokéAPI dataset for this scope.

- **`seed.sql` retired as the Pokémon-data mechanism** (DATABASE.md "Seed vs. ingestion"):
  `species`/`pokemon_form`/`data_sources` now come exclusively from
  `pnpm --filter @pokestudio/pokemon-data ingest`. `db:reset` applies schema only.
- **General ingestion pipeline** (`packages/pokemon-data`): fetch (bounded concurrency, on-disk
  cache keyed by URL, three flat phases — species → varieties → forms) → normalize (pure,
  fixture-tested) → validate (expanded invariants: type/category validity, external-identity
  collisions, orphan forms) → persist (batched, identity-based upsert). No hand-declared manifest
  — the full species list comes from PokéAPI's own listing endpoint.
- **Idempotent, identity-based persistence**: species/forms matched by `(source_id, external_id)`
  — new unique constraints added via migration — never by slug; an existing row's slug is
  preserved verbatim on every re-sync. Verified: two full runs against a freshly reset database
  produced byte-identical row counts (1025/1579) with unchanged row ids/`created_at` timestamps.
- **Form classification hardened against real edge cases** the small sample couldn't exercise
  (`packages/pokemon-data/src/classify.ts`): fixed two genuine bugs found via full-dataset
  auditing — Rotom-style forms that change type but carry no PokéAPI battle-only/mega flag (now
  classified `battle` by comparing against the species' default-variety types/stats, not just
  those flags) and Xerneas' two-state default form (neither `xerneas-active` nor
  `xerneas-neutral` matches the species name; PokéAPI's per-form `is_default` is unreliable when
  every form claims it, but correctly disambiguates when exactly one does). Both fixes are
  general rules, not per-Pokémon patches.
- **Classification/localization audit report** (`pnpm --filter @pokestudio/pokemon-data audit`):
  species/form counts, category distribution (1025 default / 220 battle / 54 regional / 280
  cosmetic), largest form families (Alcremie 64, Unown 28, Vivillon/Scatterbug/Spewpa 20 each),
  and a localization breakdown distinguishing genuine PokéAPI-provided Spanish names (273) from
  correct-by-design regional composition (54) from a real upstream data gap requiring a
  descriptor-based fallback (227, e.g. "Charizard (gmax)") — never manually translated in this
  phase, per instruction.
- **Generated Supabase types are now authoritative** (`packages/database/src/generated-database-types.ts`),
  replacing the Phase 0/1A hand-maintained subset that had already caused real `never`-inference
  bugs from small omissions.
- **Fixed a real scale bug found during the first full ingestion run**: PostgREST's default
  1000-row response cap silently truncated identity-resolution reads once the dataset exceeded it
  — both the ingestion write path and `listSpecies` now paginate past it.
- **Pokédex index now paginates** (`listSpeciesPage`, page-number navigation, no client JS/search):
  the full 1025-species index was a ~6MB response; page-size-60 responses are ~400KB.
- Expanded test coverage: classification edge cases (Rotom/Xerneas/Vivillon/Charizard-mega),
  expanded validation invariants, a persistence idempotency integration test, and full-dataset
  query integration tests (Alcremie/Xerneas/Rotom/Meowth) replacing the Phase 1A 3-species-only
  assertions.

### Phase 1A — Explore Core vertical slice (2026-09-09)

First real product feature: proves source → normalization → PostgreSQL/Supabase
→ typed data access → Pokédex index → detail page end-to-end, for a
deliberately small, structurally challenging sample.

- **Normalized species/form schema** (`supabase/migrations/20260909150000_pokemon_species_forms.sql`,
  ADR-0010): `species` (canonical identity — slug, dex number, localized
  name) and `pokemon_form` (default/regional/battle/cosmetic — types and base
  stats live here, since they differ _by form_) replace the Phase 0 flattened
  `species` spike table. PokeStudio's own `slug` is the primary identity;
  PokéAPI's id is recorded only as provenance (`source_id`/`external_id`),
  never used to look records up. Public-read/service-write RLS, same pattern
  as `data_sources`.
- **Real ingestion path** (`packages/pokemon-data`): `pokeapi-client.ts`
  (typed fetch) → `normalize.ts` (pure, unit-tested against fixture JSON, no
  network) → `validate.ts` → `scripts/ingest-explore.ts`, run against the
  live PokéAPI for Bulbasaur, Rotom (+ its 5 appliance forms: Heat/Wash/
  Frost/Fan/Mow) and Meowth (+ Alolan/Galarian regional forms). Output
  mirrored into `packages/database/supabase/seed.sql` for reproducible local
  dev. Found and worked around a real PokéAPI data-quality gap: non-default
  forms' Spanish full names are frequently missing (see DATA_SOURCES.md
  "Localized form names").
- **Domain-shaped data access** (`packages/database/src/queries.ts`):
  `listSpecies`/`getSpeciesBySlug`, returning PokeStudio-shaped results, not
  raw rows. Proved against the real seeded data — Rotom returns as one
  species with 6 related forms sharing base stats but differing types;
  Meowth's regional forms return with their own (different) types _and_ base
  stats, confirming why that data has to live on the form, not the species.
- **Pokédex routes**: `/[locale]/pokemon` (index) and `/[locale]/pokemon/[slug]`
  (detail, forms shown together with in-page jump links — no client-side
  form-switching component needed for 1-6 forms). Server-rendered per request
  (`export const dynamic = 'force-dynamic'`) — verified `next build` never
  touches the database (no local Supabase instance was running during that
  verification build, and neither route appears in the static prerender
  manifest afterward), so CI's build job needs no live Supabase instance.
  Localized title/description/canonical/hreflang/Open Graph per page;
  `sitemap.ts` now lists both routes for both locales (best-effort — falls
  back to locale-only entries rather than 500ing if the database is briefly
  unreachable).
- **No Pokémon sprite/artwork introduced.** A neutral, type-accented
  placeholder stands in for visuals pending a reviewed, license-cleared asset
  source (DATA_SOURCES.md "Phase 1A decision: no sprite/artwork source yet").
- Extended `packages/ui`'s Pokémon type-color tokens from 6 to the full
  18-type set (`--ps-type-*`), needed for this phase's real type data.
- Added a minimal `formatMessage(template, vars)` `{placeholder}` helper to
  `packages/i18n` for the handful of dictionary strings that need a value —
  the small-interpolation-helper path ADR-0009 anticipated, not a message-format
  library.

### Phase 0.5 — Foundation hardening (2026-09-09)

- **Node runtime pinned to 24 LTS** (`.nvmrc`, `package.json#engines`). Confirmed the
  `better-sqlite3` (transitive, via `pokemon-showdown`) install-time warning is caused by Node's
  current odd-numbered release having no prebuilt native binary for that dependency, forcing a
  from-source compile; Node 24 LTS has prebuilt binaries and avoids it (see DEPENDENCY_POLICY.md).
  CI already read `.nvmrc` via `node-version-file`, so no separate CI change was needed.
- **Fixed a real bug in the local Supabase workflow**: `db:start`/`db:stop`/`db:reset`/`db:diff`
  (`packages/database/package.json`) passed `--workdir supabase` while already running with
  `packages/database` as their cwd. That pointed the CLI at a second, nonexistent `supabase/`
  level, so it silently skipped the real `migrations/` and `seed.sql` and stood up an empty
  database under a stray `supabase/supabase/` directory — `db:start` reported success while the
  `species` table never existed. Verified against the real Supabase local stack (Postgres 17,
  GoTrue, PostgREST, Storage, Realtime, Studio) run via Docker: with the flag removed, `db:start`/
  `db:reset` correctly apply the committed migration and seed from a clean state, `supabase gen
types typescript --local` matches the hand-maintained `src/types.ts` subset, and the RLS
  integration suite (`packages/database/tests/rls.integration.test.ts`) passes for real against
  the running instance (anon reads succeed, anon writes are rejected, service-role writes
  succeed). Confirms the "fresh clone recreates the full dev database from committed files"
  invariant, previously only checked against a standalone Postgres fallback.
- **i18n architecture review (ADR-0009)**: compared the custom `packages/i18n` dictionary against
  `next-intl`. Kept the custom implementation — it already covers Phase 0/1 requirements (typed
  keys, App Router routing, metadata/hreflang/sitemap) in ~90 lines with no dependency; `next-intl`
  would add a config surface without measurably reducing complexity for PokeStudio's current needs.
- **Battle engine boundary hardened**: removed `parseProtocolLine` from `packages/battle-engine`'s
  public `index.ts` — it took a raw Showdown protocol-line string, which was the one place the
  public API implicitly asked callers to understand Showdown's wire format. It remains available
  internally to `adapter.ts`. No other Showdown/`@smogon/calc` internals leak outside their adapter
  packages (verified by repo-wide import search).
- **Damage engine regression coverage added**: STAB, super-effective vs. resisted ordering, and one
  fully-pinned known-good matchup (`packages/damage/src/index.test.ts`) — previously only a single
  representative case plus an immunity case existed.
- **Pokémon data normalization strategy documented (ADR-0010)** ahead of Phase 1 ingestion:
  species/form/regional-form/battle-only-form/cosmetic-form separation, generation-scoped
  types/stats, and game/format availability as an explicit join — implemented incrementally, not
  built speculatively.
- Repo hygiene: `.gitignore` now covers `research/python/.mypy_cache/`, `.ruff_cache/` and
  `*.egg-info/` (previously only `.pytest_cache/`/`__pycache__/`/`.venv/` were covered); added a
  root `README.md` "Development setup" section (Node/pnpm versions, install, web/Supabase/checks/
  Python commands) for new contributors.

### Added

- Initial PokeStudio product/architecture specification pack.
- Explore / Build / Battle Lab product model.
- PokeStudio AI grounding principles.
- Initial Supabase, Cloudflare, GitHub and Sentry architecture direction.
- Pokémon Showdown and `@smogon/calc` adapter strategy.
- Python research/AI lane.
- Source-available licensing strategy draft.
- Initial ADR set.

### Phase 0 — Foundation (2026-09-08)

- pnpm + Turborepo monorepo (`apps/web`, `packages/*`, `research/python`), strict
  TypeScript, ESLint 9 flat config, Prettier, GitHub Actions CI.
- Next.js App Router web foundation: `/en` and `/es` locales with a small
  hand-rolled i18n boundary (`packages/i18n`), dark-first/light-supported theme
  tokens with no flash-of-wrong-theme (`packages/ui`), SEO primitives
  (sitemap/robots/hreflang), a console-based observability boundary that swaps
  in for Sentry once a DSN exists.
- `packages/database`: Supabase-oriented PostgreSQL boundary. One migration
  (`data_sources` provenance table + a `species` reference table) with public-read
  / service-write RLS, verified end-to-end against a local Postgres instance
  (anon can read, anon/authenticated writes are rejected by RLS even with full
  table grants). Typed client factory; RLS integration test suite included and
  skips cleanly when no local Supabase instance is running.
- `packages/pokemon-data`: normalized species schema, dataset validator, and an
  ingestion spike that fetches 3 species from PokéAPI (BSD-3-Clause) and writes
  a provenance-tagged JSON artifact — proves the pipeline shape without being a
  runtime dependency.
- `packages/battle-engine`: adapter spike around `pokemon-showdown@0.11.11`'s
  simulator (ADR-0003). Runs a full headless battle deterministically for a
  fixed seed + fixed teams and emits a structured event trace; no upstream
  protocol strings leak past the adapter boundary.
- `packages/damage`: adapter spike around `@smogon/calc@0.11.0` (ADR-0004).
  Returns a PokeStudio-shaped damage range/description/KO-chance, handling
  zero-damage matchups (immunities) without crashing.
- `research/python`: Python research lane (ADR-0007) with a first statistical
  spike (damage-roll summary) and ruff/mypy/pytest gates.
- License status stub (`LICENSE`) pointing at `LICENSING_STRATEGY.md`/ADR-0008
  pending legal review. `THIRD_PARTY_NOTICES.md` updated with exact dependency
  versions and the PokéAPI data license.
