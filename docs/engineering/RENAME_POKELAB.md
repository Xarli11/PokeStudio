# PokeStudio → PokeLab rename

Status: repository-side rename done; **external renames pending owner approval** (GitHub, Cloudflare,
Supabase display name, DNS). Delete or archive this file once the last external step lands.

## Decisions

- Brand is **PokeLab**. Canonical domain `https://pokelab.com`; `pokelab.app` becomes a permanent redirect to it.
- Internal package scope renamed `@pokestudio/*` → `@pokelab/*`: pre-launch, purely mechanical, verified by the full gate, and leaving the old brand in every import forever is worse than one-time churn.
- Stable external IDs are kept (below). Nothing user-visible carries the old name.
- Applied SQL migrations and historical CHANGELOG entries are not rewritten.

## Intentionally retained `pokestudio` identifiers

| Identifier                                                                                                                                                                                         | Where                                                                                     | Why kept / when it changes                                                                                                                       |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Worker `pokestudio`, `https://pokestudio.carlosgt2001.workers.dev`                                                                                                                                 | `apps/web/wrangler.jsonc`, `scripts/ci/targets.json`, `scripts/smoke-cloud-dev.sh`, tests | Cloudflare cannot rename a Worker; live DEV target. Changes with the Worker migration below.                                                     |
| `Xarli11/PokeStudio`                                                                                                                                                                               | `scripts/ci/github.mjs` (allowlist, together with `Xarli11/PokeLab`), release test        | Release guard trusts exact repo names. Both accepted during transition; drop the old one after the GitHub rename.                                |
| `POKESTUDIO_*` env vars (`POKESTUDIO_PI_DB_URL`, `POKESTUDIO_RELEASE_*`, `POKESTUDIO_EXPECTED_*`, `POKESTUDIO_SMOKE_URL`, `POKESTUDIO_CLOUD_DEV_WORKER_URL`, `POKESTUDIO_PRODUCTION_APPROVED_SHA`) | `scripts/`, `.env.example`                                                                | Developer-only names; `POKESTUDIO_PI_DB_URL` lives in each developer's untracked `.env.local`. Rename is a separate, coordinated step if wanted. |
| `/home/xarli11/supabase-pokestudio`                                                                                                                                                                | `.env.example`, `docs/engineering/DATABASE.md`                                            | Pi stack directory/compose project and persistent volumes. Renaming risks data loss for zero benefit.                                            |
| localStorage keys `pokestudio:teams:v1`, `pokestudio-theme`                                                                                                                                        | `apps/web/src/lib/team-storage.ts`, `packages/ui/src/theme.ts`                            | Renaming silently drops users' saved teams/theme. Add a read-old/write-new migration only if the key must change.                                |
| Advisory lock key `pokestudio:pokemon-data:ingest`                                                                                                                                                 | `packages/pokemon-data/src/ingest-lock.ts`                                                | Shared across running ingesters; changing mid-flight would let an old and new ingester run concurrently.                                         |
| Supabase project ref `tofhupgwxsexrburoqys`                                                                                                                                                        | guards, `targets.json`                                                                    | Immutable platform ID. Guards match the ref, never the display name.                                                                             |
| Migration SQL comments                                                                                                                                                                             | `packages/database/supabase/migrations/*`                                                 | Applied history.                                                                                                                                 |
| CHANGELOG history, CI_CD audit note                                                                                                                                                                | `CHANGELOG.md`, `docs/engineering/CI_CD.md`                                               | Historical.                                                                                                                                      |

## GitHub (`Xarli11/PokeStudio` → `Xarli11/PokeLab`)

- Settings → General → rename. GitHub redirects web, `git` (HTTPS/SSH) and API URLs from the old name until a new repo is created under the old name. Redirects are not a permanent contract; update everything anyway.
- Local: `git remote set-url origin git@github.com:Xarli11/PokeLab.git`.
- Workflows/paths/triggers use no repo name. `GITHUB_REPOSITORY` changes → the release guard already accepts both; then remove `Xarli11/PokeStudio` from `TRUSTED_REPOSITORIES` and the test.
- Branch protection, required check `CI required`, Environments (`cloud-dev`, `production`), secrets, variables and rulesets are repo settings and survive a rename. Keep Environment names unchanged (they are stable IDs referenced by workflows and `targets.json`).
- Re-check after renaming: Actions still enabled, a PR shows `CI required`, Cloudflare Workers Builds/Git integration (if any remains) still points at the repo, any local clones/CI caches.

## Cloudflare (Worker `pokestudio` → `pokelab`)

Workers cannot be renamed; a new Worker is created. `assertWorker` in `scripts/ci/release.mjs` requires the target Worker to already exist in the account, be listed with an immutable tag, have **no Git build triggers**, and match `https://<worker>.<subdomain>.workers.dev`. So the order matters:

1. Owner creates Worker `pokelab` in the same account (first `wrangler deploy` from the release build, or dashboard) with no Git build integration; confirm `https://pokelab.carlosgt2001.workers.dev` responds and required vars/bindings mirror the old Worker (no Supabase secret/DB bindings — the guard rejects them).
2. PR: set `apps/web/wrangler.jsonc` `name` and `scripts/ci/targets.json` `worker`/`url` to `pokelab`, update `scripts/smoke-cloud-dev.sh`, tests and docs. Review how `bootstrapSha`/deployment-history audit behaves for a Worker with no prior release record before merging (needs a reviewed target change).
3. Merge → Cloud DEV pipeline deploys once to `pokelab` and smokes it. The old Worker keeps serving until removed: no downtime, and only one pipeline target exists so no double deploy.
4. Attach custom domains to `pokelab` (below), verify, then delete the old `pokestudio` Worker (or leave it as a redirect during a grace period).

The workers.dev endpoint stays available for both Workers throughout.

## Supabase

- Dashboard → Project Settings → General → rename to **PokeLab Dev**. Project ref, URLs, keys and DB password are unaffected.
- Guards (`scripts/db-cloud-dev-*.sh`, `scripts/ci/*`) validate `tofhupgwxsexrburoqys` in the host/API URL and pooler username, not the display name; only messages changed. No guard was loosened.
- Until the dashboard rename, messages saying "PokeLab Dev" refer to the project still displayed as "PokeStudio Dev".

## Domains

Desired end state: `pokelab.com` primary; `www.pokelab.com` → `pokelab.com`; `pokelab.app` and `www.pokelab.app` → 301 to `https://pokelab.com` (path preserved).

Code side (done): `metadataBase`, sitemap `SITE_URL` and ingestion User-Agent use `https://pokelab.com`. **Do not deploy these to a public production audience until `pokelab.com` serves the site**, otherwise canonicals point at a dead host. (DEV is workers.dev only today.)

Future steps, all external:

1. Add `pokelab.com` and `pokelab.app` as zones in Cloudflare (or transfer nameservers).
2. Worker → Settings → Domains & Routes → custom domains `pokelab.com` and `www.pokelab.com` (Cloudflare creates the proxied DNS records and certificates).
3. Redirects: Bulk/Single Redirects (or Redirect Rules) for `www.pokelab.com/*` → `https://pokelab.com/${1}` and `pokelab.app/*`, `www.pokelab.app/*` → `https://pokelab.com/${1}`, status 301. `pokelab.app` needs a proxied placeholder DNS record (e.g. `A 192.0.2.1`, proxied) so the rule can run.
4. Verify certificates, redirects, `/api/health`, sitemap and canonical tags on the real host; then submit the sitemap in Search Console.

## Local / Pi

Renamed: package scope, Supabase CLI `project_id` (`pokelab`; only names the disposable CI/local containers), Python package `pokelab_research`, log tags `[pokelab:*]`, User-Agent. Retained: Pi stack directory and volumes, `POKESTUDIO_PI_DB_URL`. No Pi data was touched.
