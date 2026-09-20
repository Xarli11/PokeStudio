# PokeStudio — Product Specification v1

## Vision

**PokeStudio is the definitive Pokémon toolkit for casual and competitive players.**

It should be useful to someone checking how a Pokémon evolves and to someone preparing a tournament team.

PokeStudio is not a collection of unrelated utilities. Features should connect into workflows.

Example target workflow:

> Search Dragonite → inspect current format data → add to team → analyze weaknesses and roles → ask AI for alternatives → validate legality → simulate matchups → battle Elite AI → inspect replay → identify critical turn → receive targeted Battle Trainer exercises.

## Product pillars

### Explore

Long-term scope:

- complete Pokédex,
- forms/regional forms/special forms,
- types,
- stats,
- abilities,
- moves,
- evolutions,
- items,
- breeding,
- egg groups,
- EV yield,
- Pokédex entries,
- shiny representation where permitted,
- game availability,
- locations,
- resistances/weaknesses,
- comparisons,
- game-aware data,
- collection tracking,
- natural-language search.

### Build

Long-term scope:

- Team Builder,
- format/generation legality,
- Showdown-compatible import/export,
- shareable teams,
- team versioning,
- public team publishing/forking later,
- damage calculation,
- defensive/offensive coverage,
- roles,
- speed tiers,
- hazards,
- weather,
- Trick Room,
- priority,
- meta threats,
- teammates/counters,
- AI team improvement,
- diverse AI team generation.

### Battle Lab

Battle Lab is a first-class product identity, not a misc-tools page.

Long-term modules:

- Battle vs AI,
- private PvP,
- Damage Lab,
- Matchup Lab,
- Simulation Lab,
- Replay Analyzer,
- Battle Trainer,
- competitive puzzles,
- daily challenges,
- spectating later,
- tournaments later.

## PokeStudio AI

AI is contextual and embedded.

Examples:

- While editing a team: “What would you change?”
- On a Pokémon page: “How do I stop this in VGC?”
- After a battle: “Where did I lose this game?”
- Search: “Fast Water Pokémon that can provide speed control.”

AI should know the relevant page/team/battle context automatically when permission and product context allow it.

AI may propose actions, but deterministic systems validate actions before application.

## Audience

Serve both:

- casual players,
- competitive VGC players,
- Smogon/formats players,
- collectors/completionists where practical.

The initial polished competitive experience may prioritize current VGC slightly ahead of deeper historical/Smogon coaching features, while the architecture remains format-neutral.

## Platform strategy

Initial:

- responsive web,
- mobile-first,
- PWA-capable architecture.

Later, if usage justifies it:

- iOS,
- Android,
- potentially desktop wrappers/native experiences.

Do not build multiple native clients before product-market evidence exists.

## Accounts

Most public reference content should work without an account.

Accounts add:

- team sync,
- collection sync,
- battle history,
- preferences,
- AI context/history where offered,
- public profile,
- community capabilities.

Initial auth candidates:

- Google,
- Discord,
- email/magic link.

Apple can be added when mobile-native distribution justifies it.

## Privacy defaults

Private by default:

- teams,
- collections,
- battle history.

Publishing/sharing is explicit.

## Multiplayer

Private invite-code PvP comes before ranked matchmaking.

Initial public ranking/Elo is not a priority.

Battle chat is not an initial feature due to moderation cost.

Replays should be serializable and shareable.

## Competitive data

Support both VGC and Smogon-oriented workflows.

Version competitive data by meaningful context:

- game/generation,
- format/regulation,
- time window.

Long-term analytics:

- usage,
- moves,
- items,
- abilities,
- spreads,
- Tera Types,
- teammates,
- counters,
- leads,
- trends,
- tournament evidence when licensable/available.

PokeStudio should progressively build its own historical analytics layer from legitimate data sources rather than permanently depending on competitor websites.

## Collection

Future tracking:

- seen,
- caught,
- shiny,
- competitive-ready,
- favorite,
- Living Dex,
- Shiny Dex,
- per-game progress.

Do not depend on private/unsupported Pokémon HOME APIs.

## Community

Community is high-weight but not a social network at launch.

Prioritize:

- public roadmap,
- feedback,
- GitHub Discussions/issues,
- public teams later,
- team likes/forks later,
- attribution lineage for forks,
- moderation before unrestricted user content.

Owner has final product decision authority.

## Public API / SDK

A public PokeStudio API/SDK is a future capability, not an initial requirement.

If introduced, it should have explicit versioning, rate limits, stable contracts and a monetization strategy only where usage creates real operating cost.

## Internationalization

Required from the beginning:

- Spanish,
- English.

Architecture must support more languages later.

Localized Pokémon terminology should be sourced from reliable structured data where possible.

## SEO

Public reference content is a growth engine.

Candidate URL families:

- `/pokemon/[pokemon]`
- `/pokemon/[pokemon]/counters`
- `/pokemon/[pokemon]/builds`
- `/moves/[move]`
- `/abilities/[ability]`
- `/items/[item]`
- `/types/[type]`
- `/formats/[format]`

Only create a page family when it provides unique user value.

## Monetization principles

PokeStudio should earn the right to charge.

Core reference functionality should remain broadly accessible.

Potential paid areas:

- expensive AI operations,
- advanced AI Coach,
- intensive replay analysis,
- large simulation jobs,
- premium personalization/history/analytics,
- supporter tier.

Additional subtle monetization may include:

- donations,
- carefully selected affiliate links,
- sponsorships later.

No intrusive interstitials. Never interrupt battles with ads.

A basic AI allowance may remain free. Paid AI should primarily map to real cost or substantial premium value.

BYOK may be supported later for advanced users.

## Success principle

PokeStudio succeeds when users stop thinking in terms of separate Pokémon utilities and instead treat PokeStudio as the place where they research, build, test and improve.
