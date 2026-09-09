# Phase 0 Bootstrap Checklist

Claude Code should use this as an execution checklist, not as permission to overbuild.

Status: Phase 0 complete as of 2026-09-08; Phase 0.5 foundation hardening complete as of
2026-09-09. See `CHANGELOG.md` for both entries.

## Repository

- [x] pnpm workspace/monorepo initialized
- [x] Node/package manager versions documented (`.nvmrc`, `package.json#engines`, `packageManager`)
- [x] strict TypeScript config (`packages/config/tsconfig-base.json`)
- [x] formatter/linter (Prettier + ESLint 9 flat config)
- [x] `.editorconfig`
- [x] `.env.example`
- [x] Git ignore/config

## Web

- [x] Next.js foundation (App Router, `apps/web`)
- [x] mobile-first shell
- [x] dark/light theme primitives (`packages/ui`, `data-theme` attribute, no FOUC)
- [x] ES/EN i18n skeleton (`packages/i18n`, `/en`, `/es` routes, locale middleware)
- [x] accessibility baseline (semantic HTML, visible focus ring, `:focus-visible`, no color-only meaning)
- [x] SEO metadata primitives (`generateMetadata`, `sitemap.ts`, `robots.ts`, hreflang alternates)

## Database

- [x] Supabase local workflow documented (`packages/database/README.md`)
- [x] migration tooling works — verified against the real Supabase local stack (Postgres 17 +
      GoTrue + PostgREST + Storage + Realtime + Studio via Docker) in Phase 0.5: clean
      `db:start`/`db:reset` apply the committed migration + seed, `supabase gen types` matches
      `src/types.ts`, and the RLS integration suite passes against the live instance. A workflow
      bug (`--workdir supabase` skipping migrations/seed) was found and fixed during this
      verification — see CHANGELOG.md "Phase 0.5".
- [x] connection boundary established (`packages/database/src/client.ts`)
- [x] no production-only manual schema state (all schema in `supabase/migrations/*.sql`)

## Data

- [x] one small ingestion proof from an approved source (PokéAPI, BSD-3-Clause, 3 species)
- [x] provenance metadata shape (`DataProvenance`, `data_sources` table)
- [x] validation proof (`validateSpeciesDataset` + tests)
- [x] no runtime PokéAPI dependency for normal rendering (ingestion is an offline script)

## Battle

- [x] battle adapter spike (`packages/battle-engine`, headless `BattleStream`)
- [x] one deterministic battle-engine test (fixed seed + fixed teams, run twice)
- [x] raw upstream internals do not leak into UI (structured `StructuredBattleEvent` union)

## Damage

- [x] `@smogon/calc` adapter spike (`packages/damage`)
- [x] one representative test (plus a zero-damage/immunity case)

## Python research

- [x] research folder/environment decision documented (`research/python/README.md`, ADR-0007)
- [x] no production Python service unless justified

## Quality

- [x] unit test runner (Vitest across all TS packages)
- [x] integration test strategy (RLS suite in `packages/database`, skipped without a live local Supabase; documented, not faked)
- [ ] E2E tool chosen — not needed for Phase 0 (no user-facing flows to protect yet); revisit at Phase 1/2
- [x] CI gates (`.github/workflows/ci.yml`: format, lint, typecheck, test, build, Python lane)
- [x] build passes (`pnpm build`)

## Security/observability

- [x] secrets strategy (`.env.example`, server/client key separation, SECURITY.md unchanged/still authoritative)
- [ ] dependency alerts — Dependabot not enabled (requires repo settings access outside this environment); tracked as a known risk
- [x] Sentry plan/minimal integration (`apps/web/src/lib/observability.ts`, console-based until `NEXT_PUBLIC_SENTRY_DSN` exists)
- [x] telemetry privacy review (observability boundary never receives secrets/tokens/private content by construction)

## Legal/provenance

- [x] third-party license inventory started (`THIRD_PARTY_NOTICES.md` updated with exact versions)
- [x] upstream notices preserved (MIT for pokemon-showdown/@smogon/calc, BSD-3-Clause for PokéAPI)
- [x] source-available license remains pending final review if not approved (`LICENSE` stub added, explicitly non-final)

## Documentation

- [x] actual implementation reflected in docs (ARCHITECTURE.md, DATA_SOURCES.md updated)
- [x] ADRs updated/superseded if required (none required — no deviations from accepted ADRs)
- [x] changelog updated
