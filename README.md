# PokeStudio.app

**Explore · Build · Battle Lab**

PokeStudio is being designed as a complete Pokémon toolkit for casual and competitive players: reference data, team building, battle simulation, AI opponents, competitive intelligence, replay analysis, collection tools and contextual AI in one coherent product.

## Current status

Phase 0 — architecture/foundation specification.

This repository should not claim feature completeness until the corresponding roadmap phases are implemented.

## Product principles

- useful without an account,
- mobile-first and fast,
- Spanish + English from the beginning,
- deterministic Pokémon correctness before AI,
- community-informed and owner-led,
- low operating cost initially,
- source-available licensing direction,
- subtle monetization focused on expensive/premium capabilities,
- strong privacy defaults,
- reuse mature battle/calculation foundations while owning PokeStudio differentiators.

## Start developing

Read `START_HERE.md`, then use `MASTER_PROMPT.md` with Claude Code.

Claude Code must also read `CLAUDE.md` before changing the project.

## Development setup

Requirements: Node **24 LTS** (see `.nvmrc`) and pnpm **9.15.0** (`packageManager` in `package.json`;
`corepack enable` picks it up automatically). Docker (or another Docker-compatible runtime) is
required only for the Supabase local stack.

```bash
pnpm install                                        # install all workspace packages

pnpm --filter @pokestudio/web dev                    # run the web app (http://localhost:3000)

pnpm --filter @pokestudio/database db:start          # start local Supabase (Postgres/Auth/Storage/…)
pnpm --filter @pokestudio/database db:reset          # apply migrations only — schema, not Pokémon data
pnpm --filter @pokestudio/database db:stop           # stop the local stack

# Populate the database with the full Pokédex (requires db:start above, and
# SUPABASE_URL / SUPABASE_SECRET_KEY — `supabase start`'s output above prints
# SECRET_KEY (sb_secret_...); see .env.example):
pnpm --filter @pokestudio/pokemon-data ingest                # fetch -> normalize -> validate -> persist
pnpm --filter @pokestudio/pokemon-data audit                 # same pipeline, report-only, no DB writes

pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build   # all TS/JS gates

cd research/python && pip install -e ".[dev]" && ruff check . && mypy . && pytest   # Python lane
```

See `packages/database/README.md` for the full local Supabase workflow and `packages/pokemon-data/README.md`
for the full ingestion pipeline (fetch/cache, idempotent upsert, classification audit). See
`research/python/README.md` for the Python research lane.

## Cloudflare Workers (DEV/staging — not deployed yet)

`apps/web` builds and runs as a Cloudflare Worker via `@opennextjs/cloudflare` (ADR-0005). Normal
local development is unaffected — `pnpm --filter @pokestudio/web dev` still runs plain `next dev`.

```bash
pnpm build:cf     # Cloudflare-target build (opennextjs-cloudflare build) — outputs apps/web/.open-next
pnpm preview:cf   # build + run the Worker locally via Wrangler (real workerd runtime, not next dev)
pnpm deploy:cf    # build + deploy to Cloudflare (do not run until DEV deployment is actually approved)
```

The deployed Worker needs these environment variables set in Cloudflare (dashboard or
`wrangler secret put`) — never committed:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

`SUPABASE_SECRET_KEY` must **never** be configured on this Worker — species/form reference data is
public-read, so the publishable key is sufficient for everything `apps/web` does server-side
(DATABASE.md "Supabase API keys"). For local Worker preview, put the same two variables in
`apps/web/.dev.vars` (gitignored, never committed).
