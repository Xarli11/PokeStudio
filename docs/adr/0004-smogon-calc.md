# ADR-0004: `@smogon/calc` as damage formula foundation

- Status: Accepted
- Date: 2026-09-08

## Context

PokeLab requires reliable damage calculations across generations and multiple product contexts.

## Decision

Use the MIT-licensed `@smogon/calc` package through a PokeLab damage-domain adapter.

## Consequences

- trusted formula base,
- PokeLab owns UI/explanation integration,
- compatibility tests protect our adapter when upgrading.
