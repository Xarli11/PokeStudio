# PokeLab rename: inventory, approval and cutover

Prepared on 2026-09-18 from `8de5e852898adef834c6dc934c546899b5774438`, branch
`codex/pokelab-rebrand`. This document describes prepared code and proposed external
changes. No repository, cloud project, Worker, Environment or DNS rename has been executed.
The initial scan found 724 old-brand references in 218 tracked files; see
[pokelab-inventory.json](pokelab-inventory.json) for the original paths and counts.

## Verified inventory

| Surface                   | Current state                                                                      | Prepared or proposed outcome                                                                         |
| ------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| GitHub                    | `Xarli11/PokeStudio`, public, ID `1361937633`, owner ID `50557033`                 | Code on a branch; propose `Xarli11/PokeLab` after approval                                           |
| Local origin              | `git@github.com:Xarli11/PokeStudio.git`                                            | Keep until external rename succeeds; then set `git@github.com:Xarli11/PokeLab.git`                   |
| Branch protection         | `main`: PR required, `CI required`, admins enforced                                | Preserve all protections and check names                                                             |
| GitHub Environments       | Only `cloud-dev`, deploys restricted to `main`                                     | Keep generic name and rules; no rename needed                                                        |
| Delivery                  | `CLOUD_DEV_CD_ENABLED=true`; production flag absent, target `null`                 | Preserve; merging to `main` automatically starts DEV delivery                                        |
| Cloudflare                | Account `aa6eb21d5a8d341a460f203ee371fda9`, Worker `pokestudio`                    | Propose Worker name `pokelab`; leave live name and targets unchanged pending approval                |
| DEV URL                   | `https://pokestudio.carlosgt2001.workers.dev`                                      | Proposed `https://pokelab.carlosgt2001.workers.dev` after approved Worker change                     |
| Worker domains            | None                                                                               | Add `pokelab.com` only in a separately approved domain/production cutover                            |
| Domain zones              | Neither `pokelab.com` nor `pokelab.app` present in this account                    | Ownership, registration, nameservers and certificates still need verification; no purchase performed |
| Other Cloudflare projects | Pages `poketypes` and `pokepedia`                                                  | Unrelated; excluded from this rename                                                                 |
| Supabase Cloud            | Display name `PokeStudio Dev`, ref `tofhupgwxsexrburoqys`, healthy, `eu-central-1` | Propose display name `PokeLab Dev`; preserve ref, API URL, DB host, credentials, data and region     |
| Supabase local tooling    | `project_id = "pokestudio"`                                                        | Preserve Docker container/volume identity                                                            |
| Raspberry Pi              | `192.168.1.236`, `/home/xarli11/supabase-pokestudio`                               | Preserve stack paths, ports and data                                                                 |
| ChatGPT project           | `PokeStudio` (mirror ID `g-p-6aa081884ed481919582f49398bfd734`)                    | Display-name change pending approval/UI; synced `sources/` unchanged                                 |
| Figma                     | Existing exported Brand 1.0 symbol                                                 | Owner handles the new logo in Figma; original SVG files and paths unchanged                          |

The Cloudflare inventory used read-only API requests. No secrets were printed or copied.
The OAuth credential could read Worker settings but the Workers Builds trigger endpoint returned 403. The [last successful guarded DEV run](https://github.com/Xarli11/PokeStudio/actions/runs/35385661057)
completed at 19:29 UTC on 2026-09-18 for the baseline SHA and required an empty build-trigger
list. Recheck trigger state with the deployment credential or dashboard before a cloud cutover.
Workers settings currently contain `ASSETS`, `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `POKESTUDIO_RELEASE_SHA` and
`POKESTUDIO_RELEASE_TARGET`. The branch changes release-generated names to `POKELAB_*`;
health checks accept the old release names during transition.

GitHub `cloud-dev` variables are `CLOUDFLARE_ACCOUNT_ID` and
`CLOUDFLARE_DEPLOY_OWNER=github-actions`. Its secret names are `CLOUDFLARE_API_TOKEN`,
`SUPABASE_DB_URL`, `SUPABASE_INGEST_KEY` and `SUPABASE_PUBLISHABLE_KEY`; these are already
brand-neutral and remain unchanged. There were no repository-level secrets in the audit.

## Changes prepared in this branch

- PokeLab visible copy in Spanish/English, accessible labels, application metadata,
  current docs, package descriptions and engineering names.
- All eight workspace packages use `@pokelab/*`; root package `pokelab`;
  Python distribution `pokelab-research`, module `pokelab_research`.
  Lockfile dependency versions remain unchanged.
- Type names, imports, package filters, scripts, CI workflows and CSS custom properties
  move together. CSS prefix is `--pl-`.
- `apps/web/src/lib/site.ts` owns `https://pokelab.com`; canonical metadata, OpenGraph
  site name, sitemap and the absolute robots sitemap URL use it. Localized home pages
  now have explicit canonical and OpenGraph URLs.
- The header combines the unchanged Figma symbol and live Inter PokeLab lettering.
  Original SVG assets remain unchanged pending the owner’s Figma exports.
- Release trust checks require the original numeric repository/owner IDs and allow
  the old/new repository names. Delivery-history matching uses stable repository ID.
  A different repository created under the old name cannot pass these checks.
- `POKELAB_PI_DB_URL` replaces the local preferred setting while `scripts/load-env.sh`
  accepts `POKESTUDIO_PI_DB_URL` as fallback. Existing private `.env.local` is untouched.
  Smoke tooling also accepts the old Worker URL override.

## Deliberately retained technical references

| Reference                                            | Reason                                                              |
| ---------------------------------------------------- | ------------------------------------------------------------------- |
| Supabase project ref / API URL / DB host             | Infrastructure identity, independent of display name                |
| `project_id = "pokestudio"` and Raspberry stack path | Avoid creating unrelated local volumes or losing the existing stack |
| `pokestudio:teams:v1`                                | Preserve users' saved teams on the current origin                   |
| `pokestudio-theme`                                   | Preserve theme choice on the current origin                         |
| `pokestudio:pokemon-data:ingest`                     | Old and new processes must acquire the same advisory lock           |
| Live Worker name, URL and `PokeStudio Dev` labels    | Accurate until approved external operations actually complete       |
| Original GitHub name in guard/tests                  | Transition compatibility, protected by stable numeric IDs           |
| Historical changelog and SQL migrations              | Keep historical evidence and applied migrations immutable           |
| Initial inventory                                    | Records original state, not new application branding                |

**Browser data is origin-scoped.** Keeping the storage keys preserves data when branding
changes on the same URL, but cannot transfer teams/theme from the old Worker hostname to
`pokelab.com` or a new Worker hostname. Before moving existing users, agree on a team
export/import or other explicit migration path and keep the old origin accessible.
Do not imply that changing DNS migrates `localStorage`.

## Reviewable approval steps (not yet executed)

1. **Code PR:** validate and review this branch. Do not merge as part of inventory work.
   Merging automatically deploys DEV. The existing ingestion planner sees lockfile/data
   package changes and may run ingestion even though the schema/data model did not change;
   it must remain guarded and use the unchanged advisory lock. No guard is bypassed.
2. **Repository rename:** owner approves `Xarli11/PokeStudio` → `Xarli11/PokeLab`.
   First land and successfully deliver the compatibility code from this PR after separate
   merge/DEV-delivery approval: the previous `main` guard only accepts the old repository
   name. Do not rename the live repository while its default-branch delivery code still
   requires the old name. Check destination availability, connected Apps and Actions references; confirm the
   numeric ID after rename. Update local origin, repository description/homepage, external
   links and integrations. Keep branch protections/check names. Do not recreate the old
   repo name, which would break its redirect. No GitHub Pages config was found in code.
3. **Supabase display name:** owner approves `PokeStudio Dev` → `PokeLab Dev` for
   `tofhupgwxsexrburoqys`. Change only the display name in Project Settings. Verify URL/ref
   and health remain unchanged; then update pending operational labels in scripts/docs.
   No project recreation, ref replacement, key rotation, schema or data migration.
4. **Cloudflare DEV:** owner approves the Worker rename to `pokelab` and the change of
   DEV hostname. First inspect current version, bindings, routes and disconnected build
   triggers; snapshot non-secret configuration and confirm rollback. Use a supported
   rename flow if available. If the provider requires replacement, stop for separate
   approval of that concrete create/copy/cutover operation. Update `wrangler.jsonc`,
   `scripts/ci/targets.json`, smoke fallback and relevant token resource scope together.
   Run protected DEV delivery and HTTP/RSC + interactive smoke. Do not delete the old
   Worker or change its hostname until user-data continuity is resolved.
5. **Domains and production:** separate approval after ownership and TLS are verified.
   `production` remains `null`; no production project/environment is implicitly created.
   Select the real production Worker/database, protections, reviewer and exact SHA before
   enabling delivery. Configure Supabase Auth Site URL, allowed redirects, OAuth provider
   callbacks and email links only if/when applicable to the real authentication setup.
   Inspect provider state before changing it; this task did not modify Auth settings.
6. **Canonical domain:** attach `pokelab.com` to the approved production target. Enable
   the separately reviewed rule in `pokelab-domain-redirects.json` on the relevant zones;
   it redirects app/www hosts to the main HTTPS origin, preserving path and query.
   DNS, TLS and the target must be working first. Do not redirect unrelated existing
   `pokestudio.app` or assume that domain belongs to this project.

The redirect JSON is a **disabled rules template**, not an apply script and not a full
replacement ruleset. Merge the reviewed rule into each relevant existing zone ruleset
without overwriting other rules. It is never consumed by builds or CI.

## Validation and rollback

Run the full repository gate, Python lint/typecheck/tests, workflow and shell validation.
The PR's disposable-database job validates migrations/persistence/locking without touching
Supabase Cloud or the Raspberry Pi. No local Supabase stack is started on this Mac.
After an approved delivery, confirm `/api/health` reports the exact SHA, target and original
project ref; smoke both languages, Build storage, entity pages and theme. For the domain
cutover also check apex/www/app redirects, query/path retention, canonical/OG/robots/sitemap
URLs, TLS and any auth callbacks. Verify branch/Environment protections after the repo rename.

Code rollback is a PR reverting this branch; persisted keys and lock remain compatible.
External renames require a coordinated reverse operation: restore names/targets/remote URL
and prior Worker version as appropriate, without deleting data or recreating Supabase.
A reverted old CI commit predates numeric-ID support and only accepts the old GitHub name;
restore that name or retain the identity-guard fix if rolling back after the repo rename.
Previously cached permanent redirects may persist, which is why DNS/redirect activation is
separately approved after verification.

## Validation evidence (2026-09-18)

- `pnpm install --offline --frozen-lockfile`: passed with Node 24. Lockfile changes are
  exactly the workspace scope rename; no third-party version changes.
- `pnpm validate:full`: passed (format, 73 delivery/guard tests, lint, TypeScript,
  594 application/package tests, Next production build, OpenNext Worker build).
- 93 existing database-backed tests skip locally because no database credentials are
  supplied. The PR disposable-database job is the integration gate; seeded-data coverage
  tests remain separate and are not claimed as executed by this rebrand.
- Python 3.13: Ruff, mypy and all 3 tests passed. CI also checks the supported Python 3.11 lane.
- All shell scripts pass `bash -n`; historical SQL, live delivery targets and original
  SVG files are byte-for-byte unchanged.
- Local built homepage inspected in English/Spanish and dark/light themes. Spanish
  canonical/OG URL resolves to `https://pokelab.com/es`, social site name and title are
  PokeLab, and no old brand text is visible. No database or deployed-state changes occurred.
- Builds produce the existing no-database sitemap fallback and toolchain warnings;
  successful compilation is not evidence that the future domains are already live.

## Provider references

- [GitHub repository renames and redirects](https://docs.github.com/en/repositories/creating-and-managing-repositories/renaming-a-repository)
- [Cloudflare Worker configuration and routes](https://developers.cloudflare.com/workers/wrangler/configuration/)
- [Cloudflare dynamic redirect settings](https://developers.cloudflare.com/rules/url-forwarding/single-redirects/settings/)
- [Supabase project management](https://supabase.com/docs/reference/api/v1-update-a-project)
- [Supabase local project identity](https://supabase.com/docs/guides/local-development/cli/config)
