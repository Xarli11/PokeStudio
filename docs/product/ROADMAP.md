# PokeStudio — Roadmap v1

This roadmap defines sequence, not immutable dates.

## Phase 0 — Foundation

Goal: disciplined production foundation.

- monorepo/tooling,
- Next.js web foundation,
- Supabase local/dev workflow,
- migrations,
- i18n ES/EN,
- design tokens/themes,
- testing/CI,
- Sentry-ready observability,
- Pokémon data ingestion spike,
- Showdown battle adapter spike,
- `@smogon/calc` adapter spike,
- licensing/provenance inventory,
- docs and ADRs.

Exit criteria: all foundation checks pass and the repository can support real vertical slices without a rewrite.

## Phase 1 — Explore Core

- normalized initial Pokémon dataset,
- Pokédex index,
- Pokémon detail pages,
- types/stats/abilities/evolutions,
- structured search/filtering,
- game/generation context foundation,
- compare Pokémon,
- SEO/i18n infrastructure proven in production.

Do not attempt every game guide/location feature yet.

**Phase 1A (complete)** proved the full vertical slice — source → normalization →
Postgres/Supabase → typed data access → Pokédex index → detail page — for a
deliberately small, structurally challenging sample (Bulbasaur, Rotom + its
forms, Meowth + its regional forms). Types/stats/SEO/EN-ES localization work
on real imported data.

**Phase 1B (complete)** proved the same model and pipeline at full scale: the
complete PokéAPI species/form dataset (~1025 species, ~1580 forms) via a
reproducible, idempotent ingestion command (`pnpm --filter @pokestudio/pokemon-data
ingest`) — no more hand-mirrored `seed.sql` sample. Form classification and
localization were hardened against real edge cases the small sample couldn't
exercise (Alcremie's 64-form cosmetic family, Xerneas' two-state default
form, Rotom-style unflagged type-changing forms). The Pokédex index now
paginates (full-dataset payload size made that necessary, not optional
polish). Abilities, evolutions, structured search/filtering, game/generation
context and Pokémon comparison remain Phase 1C+.

**Phase 1C.3 → Milestone 2 Stage 2A (complete)** added structured Type/Generation filters and
sorting to the Pokédex index, and shipped Pokémon Compare (`/[locale]/compare`, 2-4 Pokémon _or
forms_, base stats/types/abilities/defensive type matchups side by side) — the last item this
phase's own goal list named ("compare Pokémon").

## Phase 2 — Build Core

- Team Builder,
- complete set editing,
- Showdown import/export,
- legality/format validation,
- saved local teams before auth if useful,
- shareable team representation,
- defensive/offensive coverage,
- speed/role analysis foundation.

**Build v1 (Milestone 2 Stage 2B, complete)** shipped the first real version of most of this list:
a `TeamDraft` domain model, a set editor (species/form, nickname, level, ability constrained to the
form's real abilities, item, Tera type, nature, EVs/IVs, up to 4 moves constrained to what the form
can actually learn in the selected game), local persistence (`localStorage`, before auth, as
planned), and team analysis (defensive type-based profile, offensive type-only coverage, and
Incomplete/Warning/Invalid team warnings). Not yet done: Showdown import/export, full
tournament/format legality (move legality is honestly scoped to "can this form learn this move in
this game," not full VGC/Smogon rules), a shareable team representation (still local-only), and
speed/role analysis.

**Build final product shape pass (Milestone 2, complete)** reversed the temporary
Scarlet/Violet-only restriction: every historical game/version-group is now selectable, resolved
through a central `BuildGameCapabilities` model (abilities/natures/held items/modern EV-IV stats/
Tera/Dynamax/Mega Evolution/Z-Moves/special rulesets) so the Set Editor and team validity adapt
honestly per game instead of assuming modern mechanics everywhere. Still not modeled: a real
historical battle-mechanics/legality engine for Gen I/II or special-ruleset games (Let's Go,
Legends: Arceus) — those contexts are clearly identified as not-fully-validated rather than
silently treated as complete.

## Phase 3 — Damage Lab

- PokeStudio damage UI,
- reusable damage calculation domain,
- “calculate against…” flows from Pokémon/team views,
- explanation trace for modifiers,
- matchup comparison primitives.

## Phase 4 — Battle Engine + Battle UI

- authoritative battle-domain API,
- current-generation priority formats,
- Singles/Doubles foundations,
- VGC-first polish,
- replay serialization,
- structured battle trace,
- functional battle UI.

Historical mechanics expand incrementally.

## Phase 5 — Battle AI v1

- algorithmic baseline agents,
- multiple difficulty levels,
- multiple behavioral profiles,
- measurable benchmark suite,
- deterministic/reproducible evaluation seeds,
- no paid LLM per turn.

## Phase 6 — Accounts, Sync & Collection

- Supabase Auth,
- team sync,
- private-by-default model,
- collection basics,
- user preferences,
- battle history,
- profile foundation.

Auth may move earlier only if a concrete preceding feature truly needs it.

## Phase 7 — Private PvP

- invite-code rooms,
- battle server transport,
- reconnect handling,
- replay persistence/sharing,
- anti-abuse basics.

No ranked ladder required.

## Phase 8 — PokeStudio AI

- contextual AI orchestration,
- natural-language search,
- grounded team improvement,
- diverse team generation,
- action proposals with validation,
- provider abstraction,
- usage/cost accounting foundation.

## Phase 9 — Advanced Battle Lab

- Replay Analyzer,
- AI Coach,
- Matchup Lab,
- Simulation Lab,
- Battle Trainer,
- competitive puzzles/daily challenges,
- Python-backed research where useful.

## Phase 10 — Competitive Intelligence

- versioned meta analytics,
- usage/trends,
- teammates/counters,
- tournament datasets where legitimate,
- historical snapshots,
- personalized threat analysis.

Some analytics can arrive earlier if reliable data is already available.

## Phase 11 — Community

- public teams,
- likes/forks,
- attribution lineage,
- reporting/moderation,
- community curation,
- selected guides later.

No unrestricted social feed by default.

## Phase 12 — Native/mobile expansion

Only if web/PWA usage justifies investment:

- iOS,
- Android,
- platform-native features.

## Continuous tracks

Across all phases:

- accessibility,
- SEO,
- ES/EN localization,
- performance,
- security,
- Sentry/observability,
- community feedback,
- data updates,
- dependency/license audits,
- changelog.
