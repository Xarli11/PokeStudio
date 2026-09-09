# ADR-0003: Pokémon Showdown server/simulator as battle mechanics foundation

- Status: Accepted
- Date: 2026-09-08

## Context

Reimplementing all Pokémon mechanics accurately across generations would consume enormous effort and create trust-damaging bugs.

Pokémon Showdown's server/simulator is mature and MIT-licensed.

## Decision

Use compatible Pokémon Showdown server/simulator components behind a PokeStudio battle-engine adapter.

Do not copy its client as PokeStudio's UI.

## Consequences

- faster path to accurate mechanics,
- upstream compatibility must be tested,
- PokeStudio can add structured traces, simulation and AI layers,
- fork only after documented strategic need.
