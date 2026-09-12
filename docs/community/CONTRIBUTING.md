# Contributing to PokeStudio

PokeStudio is currently establishing its foundational architecture.

## Before contributing

Read:

- `CLAUDE.md`
- `docs/product/PRODUCT_SPEC.md`
- `docs/architecture/ARCHITECTURE.md`
- relevant ADRs
- `docs/legal/LICENSING_STRATEGY.md`

## Contribution model

External contributions may be limited until the initial architecture and contributor licensing process are stabilized.

Do not assume that a public repository means unrestricted commercial reuse. PokeStudio is intended to be source-available.

## Pull requests

A good PR:

- solves one coherent problem,
- includes tests when behavior changes,
- avoids unrelated refactors,
- updates docs/ADRs when needed,
- passes all CI gates,
- preserves third-party notices.

## Architecture changes

Material architecture changes require an ADR or a superseding ADR.

## Mechanics/data corrections

For Pokémon mechanics/data changes:

- provide a reliable source,
- add/update regression tests where practical,
- identify generation/game/format context.
