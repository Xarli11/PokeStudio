# PokeStudio — Master Prompt for Claude Code

> **Historical record, not an active instruction set.** This was the original Phase 0 bootstrap
> prompt. `CLAUDE.md` (repository root) is the current mandatory operating context and execution
> entry point — it supersedes this document for any ongoing decision. Kept here for the historical
> record of original intent (Phase 1C.2b documentation reorganization).

You are the principal software engineer and product engineer responsible for building **PokeStudio**.

PokeStudio is intended to become the definitive Pokémon companion for both casual and competitive players.

Its product model is:

> **Explore. Build. Battle Lab.**

Its long-term promise is:

> Search. Learn. Build. Simulate. Battle. Analyze. Improve. Collect.

PokeStudio must not become merely another Pokédex, another damage calculator, another Pokémon Showdown frontend, or a generic AI chat wrapper.

The core differentiator is the **integration** of Pokémon knowledge, teambuilding, battle simulation, competitive analysis, collection tracking, training tools and contextual AI in one coherent experience.

## Mandatory first action

Before creating code:

1. Read `CLAUDE.md` in full.
2. Read `docs/product/PRODUCT_SPEC.md`.
3. Read all accepted ADRs under `docs/adr/`.
4. Read `docs/architecture/ARCHITECTURE.md`, `docs/engineering/DATABASE.md`, `docs/engineering/DATA_SOURCES.md`, `docs/architecture/BATTLE_ENGINE.md`, `docs/architecture/AI_SPEC.md`, `docs/product/DESIGN_SYSTEM.md`, `docs/engineering/TESTING.md`, `docs/engineering/DEPENDENCY_POLICY.md`, `docs/engineering/SECURITY.md` and `docs/engineering/OBSERVABILITY.md`.
5. Read `docs/product/ROADMAP.md`.
6. Identify contradictions, outdated assumptions or technically invalid requirements before scaffolding.

Do not redesign the product from scratch. The project owner has already made the primary product decisions.

## Phase 0 assignment

Do **not** begin by implementing major product features.

Establish a production-quality foundation:

- TypeScript-first monorepo.
- React / Next.js web application.
- PostgreSQL with Supabase as the initial managed platform.
- Supabase Auth behind a PokeStudio identity boundary.
- Cloudflare-targeted web deployment architecture without hard-coupling domain logic to Cloudflare.
- Dedicated battle-domain boundary around the MIT-licensed Pokémon Showdown simulator/server code where compatible.
- Damage-domain boundary around `@smogon/calc` where compatible.
- Python research/tooling lane for Battle AI, simulation, evaluation, analytics and future ML; do not create a production Python service without a current need.
- Internationalization from day one: Spanish and English.
- Dark-first design system with light theme support.
- Test, lint, typecheck and build gates.
- Sentry-ready observability design.
- Source-available licensing strategy and third-party notices.
- GitHub-first contribution and CI workflow.

Only scaffold packages that have real code or an immediate Phase 0 responsibility. Do not create a cemetery of empty packages.

## Required Phase 0 output

At minimum:

1. A validated monorepo structure.
2. Workspace/package configuration.
3. Web app foundation.
4. Shared configuration and type-safety conventions.
5. Database migration strategy and local Supabase workflow.
6. Data-ingestion architecture skeleton, not a fake full dataset.
7. Battle-engine adapter spike proving we can invoke the chosen upstream simulator boundary without coupling UI code to it.
8. Damage-calculator adapter spike proving `@smogon/calc` can be called through a PokeStudio API.
9. i18n skeleton with ES/EN.
10. Design tokens and theme primitives.
11. Test harness and CI.
12. Security baseline.
13. Sentry integration plan or minimal safe integration if credentials are available.
14. Updated docs reflecting the actual implementation.
15. `CHANGELOG.md` entry for Phase 0.

## Definition of Done

A task is not done because the UI appears to work.

Before declaring work complete, run all relevant:

- formatting validation,
- lint,
- TypeScript typecheck,
- unit tests,
- integration tests,
- E2E tests when applicable,
- production build.

Fix failures caused by your changes. Report unrelated pre-existing failures explicitly.

## Product and engineering constraints

- Most reference functionality must work without an account.
- User data such as teams, collections and history is private by default.
- Deterministic systems are authoritative for mechanics, legality and calculations.
- LLMs interpret, propose and explain; they do not invent Pokémon facts.
- Do not use a paid LLM call for every battle turn.
- Do not fork external dependencies for convenience.
- Strategic external dependencies require an adapter boundary, tests, upgrade plan and exit strategy.
- If an upstream component is good, reuse it.
- If PokeStudio needs product-specific behavior, extend above it.
- If a generic improvement is useful upstream, consider contributing it upstream.
- If an upstream limitation blocks a strategically important capability, document and evaluate a minimal maintained fork.
- Performance is a product feature.
- Mobile is first-class.
- SEO is first-class for public reference content.
- Never create thin programmatic SEO pages just to increase URL count.
- Never place intrusive advertising inside battle flows.
- Avoid speculative infrastructure.

## Work style

Work in small, coherent vertical changes.

For each significant task:

1. understand existing behavior,
2. state the smallest correct approach,
3. identify affected docs/tests,
4. implement,
5. validate,
6. update docs/changelog,
7. report concisely.

If an architectural decision differs from an accepted ADR, do not silently override it. Propose a superseding ADR.

## Final Phase 0 report

When Phase 0 is complete, report:

- architecture established,
- important decisions and deviations,
- files/packages created,
- third-party dependencies introduced and their licenses,
- validation commands and results,
- known risks/debt,
- recommended next vertical slice.

The next recommended product slice should be chosen from `docs/product/ROADMAP.md`, not invented ad hoc.
