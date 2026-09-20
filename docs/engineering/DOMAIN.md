# PokeStudio public domain

Owner decision, 2026-09-20: the brand is **PokeStudio** and the primary public
origin is **https://pokestudio.pro**. The TLD is not part of the product name.

## Repository state and abandoned rename

This change starts from `main` at `8de5e852898adef834c6dc934c546899b5774438`.
Main retains PokeStudio. Neither of the abandoned rename branches may be merged:

- `chore/rename-pokestudio-to-pokelab`: `7bf99e0` (rename) and `60d40f7` (Worker change).
  There was no PR for this branch at inspection. It is retained only as history.
- `codex/pokelab-rebrand`: `8f328da` and `d57b9f3`.
  [PR #7](https://github.com/Xarli11/PokeStudio/pull/7) was closed without merging.

No commits from either branch are included here. Do not resurrect those changes,
rename the repository, or select the alternate Worker.

## Public URLs and stable identities

`apps/web/src/lib/site-url.ts` supplies metadataBase and sitemap/robots URLs.
Public page canonicals, hreflang and Open Graph URLs resolve against that origin,
including the localized homepages. Filter/query-state URLs continue to canonicalize
to their existing shells; private local team editors remain non-indexable.

The following remain unchanged:

- package names/scopes/imports, environment variable and secret names;
- localStorage keys, team schema, CSS tokens, Python module and brand assets;
- Pi paths, Supabase refs/configuration, historical migrations and advisory lock;
- Cloud DEV target: Worker `pokestudio`,
  `https://pokestudio.carlosgt2001.workers.dev`, project ref `tofhupgwxsexrburoqys`;
- `scripts/ci/targets.json`, Wrangler routing, smoke target and release guards;
- production target: `null` (unconfigured).

One legacy domain string is intentionally retained inside the existing versioned
`PokeStudio-ingestion/0.2` User-Agent in `packages/pokemon-data/src/pokeapi-client.ts`.
It is a technical identification string, not a public page/canonical or a request
destination. Changing that importer file would correctly trigger a full ingestion
under the current conservative release policy. Update its contact URL during the
next already-required importer release; do not weaken the guard or launch a data
refresh solely for this domain change. The present diff does not require ingestion
when there are no other importer changes, pending migrations, bootstrap or force flag.

## Ownership and activation

On 2026-09-20, the owner completed registration and the authenticated Cloudflare
dashboard displayed successful registration of `pokestudio.pro` with a domain
management link. Domain control is verified; this is not evidence of active DNS,
a Worker binding, certificate readiness or a production release.

This PR prepares public metadata. It does not activate the domain. Keep it draft
until the domain routing decision is ready: merging changes the canonical emitted
by Cloud DEV even if the new host is not yet serving the application.

Before activation:

1. Check the zone's DNS and certificate status in the owner's Cloudflare account.
2. Review domain routing separately. Binding the public apex to the existing Worker
   would expose **Cloud DEV and its DEV database**, not create a production environment.
   Production requires its separately reviewed target per [CI_CD.md](CI_CD.md).
3. Preserve the existing `pokestudio` Worker and workers.dev address. Do not add a
   second deploy channel or Cloudflare Git build trigger. Review any DNS/custom-domain
   change and its rollback before applying it; do not route to the abandoned Worker.
4. Merge only after PR checks pass and routing is ready. Let the serialized main
   pipeline perform its normal validation, delivery and smoke; no manual deployment
   or forced ingestion in parallel.
5. Verify HTTPS, EN/ES routes, absolute canonical/hreflang/Open Graph, robots, sitemap,
   and deployed SHA/target. Do not redirect an old domain unless ownership is proven.

LocalStorage is scoped to the browser origin. Existing teams/themes at workers.dev
do not automatically appear at the new domain even though their keys are preserved.
Keep the old address available and plan user data transfer before any forced redirect.

## Rollback

Before merge, closing this PR leaves the serving application unchanged. After merge,
revert the domain commit through a reviewed PR and the same main pipeline. If routing
was later activated, undo only the separately recorded binding/DNS changes; do not
delete the existing Worker, alter database identities or run ingestion as a rollback.
