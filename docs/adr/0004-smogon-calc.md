# ADR-0004: `@smogon/calc` as damage formula foundation

- Status: Accepted
- Date: 2026-09-08

## Context

PokeStudio requires reliable damage calculations across generations and multiple product contexts.

## Decision

Use the MIT-licensed `@smogon/calc` package through a PokeStudio damage-domain adapter.

## Consequences

- trusted formula base,
- PokeStudio owns UI/explanation integration,
- compatibility tests protect our adapter when upgrading.
