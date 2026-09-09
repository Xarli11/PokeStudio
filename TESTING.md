# PokeStudio — Testing Strategy

## Philosophy

Pokémon correctness is a trust feature.

A visual bug is annoying. A mechanics/legality bug makes the product unreliable.

## Test pyramid

### Unit tests

Use for:

- domain rules,
- parsers,
- transformations,
- search constraints,
- team-analysis logic,
- adapters with deterministic fixtures.

### Integration tests

Use for:

- database/migrations,
- RLS authorization,
- data ingestion,
- battle adapter,
- damage adapter,
- API boundaries.

### E2E

Use for critical user workflows:

- search/view Pokémon,
- build/import/export team,
- calculate damage,
- start/complete battle when available,
- auth/private sharing when available.

## Battle regression suite

Every discovered mechanics/adapter bug should gain a regression test when practical.

Cover:

- generation differences,
- ability/item interactions,
- move edge cases,
- forms,
- turn ordering,
- replay serialization,
- structured traces,
- updates to upstream battle dependency.

## Damage testing

Test PokeStudio wrapper behavior and representative known calculations.

Do not duplicate every upstream test unless we need compatibility guarantees at our boundary.

## Data validation tests

Examples:

- no dangling references,
- stable IDs unique,
- evolution graph sane,
- localizations refer to valid entities,
- expected generation/game context present,
- ingestion is deterministic for same source revision.

## Security tests

When auth arrives:

- private team isolation,
- collection isolation,
- RLS negative tests,
- unauthorized mutation attempts,
- public-sharing rules.

## CI gates

Every pull request should run relevant:

- formatter check,
- lint,
- typecheck,
- unit/integration tests,
- build,
- E2E for affected critical workflows where feasible.

## Flaky tests

Do not accept permanent flaky tests as normal.

Fix, quarantine temporarily with a tracked reason, or remove only if invalid.

## Performance benchmarks

Add targeted benchmarks when performance matters, especially:

- battle simulation throughput,
- AI action evaluation,
- search latency,
- large team/meta queries.

Do not turn microbenchmarks into a blocking religion without user impact.
