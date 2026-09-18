# PokeLab documentation index

`README.md` (repository root) is the public project entry point. `CLAUDE.md` (repository root) is
the mandatory operating context for Claude Code — read automatically before any change, and the
current execution entry point (superseding `docs/product/MASTER_PROMPT.md`, the original Phase 0
bootstrap prompt, kept only as a historical record).

## Authority order

When documents conflict, resolve in this order:

1. Explicit current instruction from the project owner.
2. `CLAUDE.md` engineering rules (repository root).
3. `docs/product/PRODUCT_SPEC.md` product intent.
4. ADRs under `docs/adr/` for accepted architectural decisions.
5. `docs/architecture/`, `docs/engineering/` reference docs.
6. `docs/product/ROADMAP.md` sequencing guidance.

Do not silently resolve contradictions. Update the relevant document or create an ADR.

## Product

- [`product/PRODUCT_SPEC.md`](product/PRODUCT_SPEC.md) — what PokeLab is and its product principles.
- [`product/ROADMAP.md`](product/ROADMAP.md) — phase sequencing; what to build next and what to defer.
- [`product/FEATURE_MATRIX.md`](product/FEATURE_MATRIX.md) — feature status by pillar.
- [`product/BRAND_BRIEF.md`](product/BRAND_BRIEF.md) — brand direction and visual identity brief.
- [`product/DESIGN_SYSTEM.md`](product/DESIGN_SYSTEM.md) — tokens, typography, component conventions.
- [`product/MONETIZATION.md`](product/MONETIZATION.md) — monetization direction.
- [`product/MASTER_PROMPT.md`](product/MASTER_PROMPT.md) — historical Phase 0 bootstrap prompt.

## Architecture

- [`architecture/ARCHITECTURE.md`](architecture/ARCHITECTURE.md) — system architecture overview.
- [`architecture/BATTLE_ENGINE.md`](architecture/BATTLE_ENGINE.md) — battle simulation boundary.
- [`architecture/AI_SPEC.md`](architecture/AI_SPEC.md) — PokeLab AI design and constraints.

## Engineering & data

- [`engineering/DATABASE.md`](engineering/DATABASE.md) — Supabase/Postgres strategy, migrations, RLS.
- [`engineering/DATA_SOURCES.md`](engineering/DATA_SOURCES.md) — provenance, ingestion, source limitations.
- [`engineering/DEPENDENCY_POLICY.md`](engineering/DEPENDENCY_POLICY.md) — external dependency policy.
- [`engineering/TESTING.md`](engineering/TESTING.md) — test strategy and gates.
- [`engineering/OBSERVABILITY.md`](engineering/OBSERVABILITY.md) — error tracking and metrics.
- [`engineering/SECURITY.md`](engineering/SECURITY.md) — security baseline.
- [`engineering/SOURCES.md`](engineering/SOURCES.md) — external references checked for this spec.
- [`engineering/BOOTSTRAP_CHECKLIST.md`](engineering/BOOTSTRAP_CHECKLIST.md) — Phase 0 completion record and remaining open items (E2E tooling, Dependabot).

## Architecture Decision Records

- [`adr/`](adr/) — one file per accepted architectural decision, numbered sequentially. Material
  architecture changes require a new or superseding ADR (see `CLAUDE.md` §13).

## Community & legal

- [`community/COMMUNITY.md`](community/COMMUNITY.md) — community model.
- [`community/CONTRIBUTING.md`](community/CONTRIBUTING.md) — how to contribute.
- [`legal/LICENSING_STRATEGY.md`](legal/LICENSING_STRATEGY.md) — source-available licensing direction.
- [`legal/THIRD_PARTY_NOTICES.md`](legal/THIRD_PARTY_NOTICES.md) — upstream license notices.

## Package-level docs

Implementation-specific documentation stays next to the code it documents, not here:

- `packages/database/README.md` — local Supabase workflow.
- `packages/pokemon-data/README.md` — ingestion pipeline.
- `research/python/README.md` — Python research lane.
