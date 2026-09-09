# ADR-0002: Supabase as initial managed PostgreSQL/Auth platform

- Status: Accepted
- Date: 2026-09-08

## Context

PokeStudio needs a low-cost PostgreSQL foundation and will later need authentication, private user data and storage. Supabase bundles these capabilities while retaining PostgreSQL underneath.

## Decision

Use Supabase initially for managed PostgreSQL and Auth, with Storage/Realtime only when useful.

Keep the domain model PostgreSQL-centric and isolate provider-specific identity/storage behavior.

## Consequences

- fast/cheap startup,
- integrated RLS/auth capabilities,
- migrations/local workflow required,
- portability must be protected by boundaries.
