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

## Phase 2 — Build Core

- Team Builder,
- complete set editing,
- Showdown import/export,
- legality/format validation,
- saved local teams before auth if useful,
- shareable team representation,
- defensive/offensive coverage,
- speed/role analysis foundation.

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
