# PokeLab

**Explore · Build · Battle Lab**

PokeLab is being designed as a complete Pokémon toolkit for casual and competitive players: reference data, team building, battle simulation, AI opponents, competitive intelligence, replay analysis, collection tools and contextual AI in one coherent product.

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
- reuse mature battle/calculation foundations while owning PokeLab differentiators.

## Start developing

Claude Code reads `CLAUDE.md` automatically as mandatory operating context before changing
anything in this repository — it is the execution entry point. See `docs/README.md` for the full
documentation index (product, architecture, engineering, design, community, legal, ADRs).
`docs/product/MASTER_PROMPT.md` is kept as the original Phase 0 project brief for historical
reference, not an active instruction set.

## Development setup

Requirements: Node **24 LTS** (see `.nvmrc`) and pnpm **9.15.0** (`packageManager` in `package.json`;
`corepack enable` picks it up automatically).

Normal local development does **not** run Supabase on the Mac — it talks to a self-hosted Supabase
instance on a Raspberry Pi over the LAN (CLAUDE.md §21 "Local Development Database"). Docker is not
required for normal development.

```bash
pnpm install                                        # install all workspace packages

# Copy .env.example to .env.local and fill in the Raspberry Pi's URL/keys, then:
pnpm db:pi:check                                    # confirm .env.local really points at the Pi
pnpm dev:pi                                          # run the web app (http://localhost:3000) against it

pnpm db:pi:migrate                                   # apply packages/database/supabase/migrations/*.sql to the Pi
pnpm ingest:pi                                       # fetch -> normalize -> validate -> persist the Pokédex to the Pi
pnpm --filter @pokelab/pokemon-data audit          # same pipeline, report-only, no DB writes

pnpm validate:full     # format, lint, typecheck, all tests, Next build, Cloudflare build — full gate
pnpm validate:changed  # same checks scoped to changed packages/dependents — for use mid-implementation

cd research/python && pip install -e ".[dev]" && ruff check . && mypy . && pytest   # Python lane
```

See `docs/engineering/DATABASE.md` "Raspberry Pi local development" for the full workflow and
architecture, `packages/database/README.md` for migrations, and `packages/pokemon-data/README.md`
for the full ingestion pipeline (fetch/cache, idempotent upsert, classification audit). See
`research/python/README.md` for the Python research lane.

A local Supabase stack started with `supabase start` (Docker) is exceptional — an isolated test
environment, never the normal dev path. See `packages/database/README.md` "Isolated local Supabase
(exceptional)".

## Cloudflare Workers (DEV/staging)

`apps/web` builds and runs as a Cloudflare Worker via `@opennextjs/cloudflare` (ADR-0005), deployed
manually (no CI auto-deploy) to a `*.workers.dev` subdomain — DEV/staging only, no custom domain or
production routes configured yet (`apps/web/wrangler.jsonc`). Normal local development is
unaffected — `pnpm --filter @pokelab/web dev` still runs plain `next dev`.

```bash
pnpm build:cf     # Cloudflare-target build (opennextjs-cloudflare build) — outputs apps/web/.open-next
pnpm preview:cf   # build + run the Worker locally via Wrangler (real workerd runtime, not next dev)
pnpm deploy:cf    # build + deploy to Cloudflare — confirm with the project owner before running
```

The deployed Worker needs these environment variables set in Cloudflare (dashboard or
`wrangler secret put`) — never committed:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

`SUPABASE_SECRET_KEY` must **never** be configured on this Worker — species/form reference data is
public-read, so the publishable key is sufficient for everything `apps/web` does server-side
(docs/engineering/DATABASE.md "Supabase API keys"). For local Worker preview, put the same two variables in
`apps/web/.dev.vars` (gitignored, never committed).

## Delivery

[CI/CD audit and activation runbook](docs/engineering/CI_CD.md) documents the guarded delivery
workflows and the remaining remote setup. Production activation requires explicit approval.
