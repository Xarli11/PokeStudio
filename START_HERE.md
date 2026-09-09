# PokeStudio.app — Claude Code Starter Pack

Status: **Product specification v1 / Phase 0 bootstrap pack**  
Date: **2026-09-08**

This pack is intended to be copied into a new, empty PokeStudio repository before Claude Code writes product code.

## What to do

1. Copy the contents of this pack to the repository root.
2. Open Claude Code in that repository.
3. Give Claude the contents of `MASTER_PROMPT.md` as the first project instruction.
4. Claude must read `CLAUDE.md` and all referenced authoritative docs before scaffolding.
5. Phase 0 ends only when the foundation is validated and documented. Do not jump directly into implementing the Pokédex.

## Authority order

When documents conflict, use this order:

1. Explicit current instruction from the project owner.
2. `CLAUDE.md` engineering rules.
3. `PRODUCT_SPEC.md` product intent.
4. ADRs under `docs/adr/` for accepted architectural decisions.
5. `ARCHITECTURE.md`, `BATTLE_ENGINE.md`, `AI_SPEC.md`, `DATABASE.md`, `DATA_SOURCES.md`.
6. `ROADMAP.md` sequencing guidance.

Do not silently resolve contradictions. Update the relevant document or create an ADR.

## Core product structure

PokeStudio is organized around three pillars:

- **Explore** — Pokémon knowledge, search, game-aware data, collection.
- **Build** — Team Builder, legality, damage, meta analysis, team intelligence.
- **Battle Lab** — battles vs AI, PvP, simulation, replay analysis, training and experimentation.

**PokeStudio AI is horizontal.** It is not a separate chatbot product; it assists users inside Explore, Build and Battle Lab using deterministic PokeStudio systems as sources of truth.

## Important status notes

- `PokeStudio.app` is the current product name and should be used throughout the codebase unless the owner changes it.
- The repository is intended to be **source-available**, not OSI Open Source, because commercial reuse by third parties is intended to be restricted.
- Final license text and trademark/IP decisions must be reviewed before public launch.
