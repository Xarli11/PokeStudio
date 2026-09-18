# ADR-0001: TypeScript-first modular monorepo

- Status: Accepted
- Date: 2026-09-08

## Context

PokeLab combines web UI, data/domain logic, battle integration and AI orchestration. Sharing types and domain code is valuable, while early microservices would add operational cost.

## Decision

Use a TypeScript-first modular monorepo.

Python is permitted for research/AI/simulation tooling but is not an automatic production service.

## Consequences

- shared domain/types are easy,
- one CI/workspace initially,
- service boundaries can be extracted later,
- package boundaries must not become speculative empty modules.
