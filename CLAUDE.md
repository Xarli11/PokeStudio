# CLAUDE.md — PokeStudio Engineering Constitution

This file is mandatory operating context for Claude Code.

## 1. Mission

Build **PokeStudio.app**, a fast, elegant, trustworthy and community-driven Pokémon platform for casual and competitive players.

The product pillars are:

- **Explore**
- **Build**
- **Battle Lab**

PokeStudio AI assists across all three.

## 2. Owner-led product decisions

PokeStudio is **community-informed, owner-led**.

Community feedback has high weight, but popularity alone does not override correctness, product coherence, security, sustainability or owner decisions.

Do not change product direction because an implementation is easier.

## 3. Ponytail engineering rule

Use the **smallest correct solution**.

Preference order:

1. reuse correct code already in the repository,
2. platform/native capabilities,
3. standard library,
4. trusted existing dependencies,
5. a small local abstraction,
6. custom infrastructure only when there is a demonstrated requirement.

Apply YAGNI aggressively.

Do not add Redis, queues, microservices, event buses, repositories, factories, adapters, workers, caches or abstraction layers merely because PokeStudio might need them later.

Do not prebuild a future architecture. Build an architecture that can evolve.

Prefer small diffs. Avoid unrelated refactors.

## 4. Caveman communication rule

Engineering reports should be compressed but precise.

Default completion report:

- **Changed:** what changed.
- **Decision:** important decision, if any.
- **Validated:** exact relevant checks run.
- **Remaining:** only actual known issue or next step.

No filler, ceremony or self-congratulation.

Do **not** apply Caveman style to user-facing product copy, legal text, public documentation or educational explanations.

## 5. Own the differentiators

> **Reuse commodities. Own differentiation. Improve dependencies when doing so creates real value.**

Do not rebuild PostgreSQL, authentication primitives, React, Pokémon mechanics or well-tested damage formulas for pride.

PokeStudio should own and improve areas that create product advantage, including:

- Battle Lab UX,
- battle intelligence,
- Battle AI,
- AI Coach,
- structured battle traces,
- Replay Analyzer,
- Simulation Lab,
- team intelligence,
- natural-language search,
- PokeStudio normalized data model,
- integrated casual + competitive workflows.

## 6. External dependencies are not untouchable

Follow `DEPENDENCY_POLICY.md`.

For strategic dependencies:

- verify license,
- isolate behind a PokeStudio boundary,
- pin/manage versions deliberately,
- maintain compatibility tests,
- document updates,
- maintain an exit strategy.

Never fork merely for convenience.

## 7. Deterministic truth before AI

LLMs are not authoritative for:

- Pokémon mechanics,
- legality,
- damage,
- stats,
- learnsets,
- format rules,
- battle state.

Sources of truth:

- normalized PokeStudio data → facts,
- battle engine → mechanics,
- damage engine → calculations,
- legality/format engine → validity,
- versioned statistics → meta evidence,
- LLM → language understanding, explanation and proposals.

Every AI-generated team must be validated before being presented as legal.

## 8. Battle AI cost rule

Do not use a paid LLM call for every battle decision.

The battle agent must be algorithmic and measurable. LLMs may assist with explanation, coaching and high-level analysis.

## 9. TypeScript and Python

TypeScript is the primary production language initially.

Python is intentionally allowed from early phases for:

- simulation experiments,
- Battle AI research,
- statistical analysis,
- notebooks,
- evaluation,
- ML/RL experiments,
- data-science tooling.

Do not introduce FastAPI or a Python production service until a current runtime requirement justifies it.

If Python becomes production-critical, document the boundary in an ADR.

## 10. Data model discipline

External APIs are inputs, not PokeStudio's runtime domain model.

Do not model Pokémon as if data is globally identical across all games/generations.

Game/generation/format context must be preserved where mechanics or availability differ.

Do not query PokéAPI on every normal page request.

## 11. User privacy defaults

Teams, battle history and collection data are **private by default**.

Sharing is explicit.

Apply least privilege and RLS where relevant.

## 12. Product quality gates

Never declare a task complete without relevant validation.

Minimum expected gates where applicable:

```text
format/lint
typecheck
tests
build
```

Add regression tests for mechanics bugs.

Do not silence tests to make CI green.

## 13. Documentation is part of the change

If architecture, data sources, product behavior, public APIs, security posture or operational behavior changes, update the corresponding documentation in the same change.

Important architectural decisions require an ADR.

Update `CHANGELOG.md` for meaningful product/engineering milestones.

## 14. No fake completeness

Avoid:

- production features backed by fake data,
- placeholder APIs pretending to work,
- TODOs with no owner/reason,
- dead packages,
- speculative database tables,
- premature background workers,
- “temporary” duplicate architecture.

Mocks are fine in tests and explicit development fixtures.

## 15. Security baseline

Treat all imports, user text, URLs, teams, profile content and battle payloads as untrusted.

Validate at boundaries.

Secrets remain server-side.

Never implement custom cryptography.

Do not log access tokens, API keys or private user data.

## 16. Performance baseline

Mobile-first.

Avoid shipping entire datasets to clients.

Prefer server/data-layer filtering and contextual loading.

Use caching only when it solves a measured or obvious repeated-work problem.

Avoid large animation libraries for effects the platform/CSS handles well.

## 17. SEO baseline

Public reference pages are indexable and useful.

Do not create thin pages solely for SEO.

Use canonical URLs, structured metadata, sitemap infrastructure and localized metadata.

## 18. Brand rule

Current product name: **PokeStudio.app**.

Visual direction:

- premium,
- elegant,
- futuristic,
- minimal,
- dark-first,
- light theme supported,
- Pokémon type colors used semantically, not as the core brand palette,
- no imitation of official Pokémon visual identity.

Do not create a Poké Ball-derived logo by default.

## 19. Scope control

Follow `ROADMAP.md`.

Do not jump to community feeds, public ranking, tournaments, mobile-native apps or complex AI infrastructure before the foundations they depend on exist.

## 20. When uncertain

If a decision materially changes architecture, licensing, recurring cost, privacy, security, IP exposure or user-visible product direction, surface it to the owner instead of silently choosing.

For normal implementation details, use your judgment and keep moving.
