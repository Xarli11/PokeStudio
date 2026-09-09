# @pokestudio/pokemon-data

Full Pokédex ingestion pipeline (Phase 1B, ADR-0010): fetch/cache → normalize → validate → persist.
Not a runtime PokéAPI client — the web app never imports this package or calls PokéAPI at request
time (CLAUDE.md §10); it only reads what this pipeline already wrote to Postgres, via
`@pokestudio/database`.

## Commands

Requires a running local Supabase instance with the schema migrations applied
(`pnpm --filter @pokestudio/database db:start && pnpm --filter @pokestudio/database db:reset`)
and `SUPABASE_URL`/`SUPABASE_SECRET_KEY` set (`db:start` prints `SECRET_KEY`; see `.env.example`
and DATABASE.md "Supabase API keys"). To target Supabase Cloud instead of local, set `SUPABASE_URL`
to the project's URL and `SUPABASE_SECRET_KEY` to its secret key (`sb_secret_...`, from the
project's API settings) — never commit either.

```bash
pnpm --filter @pokestudio/pokemon-data ingest   # full pipeline: fetches, normalizes, validates, writes
pnpm --filter @pokestudio/pokemon-data audit     # same pipeline, report-only — no DB writes, no secret key needed
```

Both accept:

- `--limit=N` — only the first N species (fast iteration; the default is the full ~1000+ species)
- `--concurrency=N` — requests in flight per fetch phase (default 12)
- `--no-cache` — bypass the on-disk raw-response cache and hit PokéAPI directly

`ingest` prints a classification/localization audit and a performance report (request count, fetch/
persist duration, species/form counts) on completion. Non-zero exit and no DB writes if validation
fails.

## Pipeline shape

```text
fetch (species list -> species detail -> variety/pokemon detail -> per-form detail)
    ↓  (bounded concurrency, on-disk cache — packages/pokemon-data/.cache/, gitignored)
normalize (species + form, classified — packages/pokemon-data/src/classify.ts)
    ↓
validate (invariants — packages/pokemon-data/src/validate.ts; failure blocks persist entirely)
    ↓
persist (batched upsert by (source_id, external_id) identity — packages/pokemon-data/src/persist.ts)
```

Fetch and normalize are pure/testable independently: `src/normalize.ts`'s tests use literal
fixture JSON, never a live network call. The three fetch phases (species → varieties → forms) each
run through one flat, globally-bounded-concurrency pool (`src/concurrency.ts`) rather than nested
per-species concurrency, so total requests in flight never exceeds `--concurrency` regardless of
how large one species' form family is (Alcremie: 64 forms under a single species).

## Idempotency

Re-running `ingest` never duplicates species/forms: rows are matched by upstream identity
(`source_id` + `external_id`, not slug), and an existing row's `slug` is always preserved verbatim
on update — only other fields (name, types, stats, category) refresh. See `src/persist.ts`'s
top comment for the full write strategy, and `tests/persist.integration.test.ts` for the
executable proof.

## Form classification

`src/classify.ts` centralizes every classification rule (default/regional/battle/cosmetic) —
driven by PokéAPI's own structural signals (`is_mega`, `is_battle_only`, a form's types/stats vs.
its species' default variety), plus one small, documented, centralized exception list
(`REGION_LABELS`) for regional-form detection. No per-Pokémon `if name === ...` branches. See its
tests for the representative edge cases this was built and hardened against (Rotom's unflagged
type-changing appliance forms, Vivillon's unreliable per-form `is_default`, Xerneas' two-state
default-form quirk).
