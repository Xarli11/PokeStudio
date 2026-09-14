/**
 * Case-insensitive canonical entity routes (Phase 1C.3 §13) — used by
 * `middleware.ts` for `/[locale]/pokemon/[slug]`, `/[locale]/moves/[slug]`
 * and `/[locale]/abilities/[slug]`. Canonical slugs are always lowercase
 * (every slug PokeStudio's ingestion writes already is); this only decides
 * *whether the requested URL itself* needs a redirect, purely from casing —
 * it never checks whether the lowercased slug actually exists. That's
 * deliberate: an existence check here would mean either doing the DB lookup
 * twice (once to decide, once to render) or coupling this helper to a
 * specific query function. The page's own `getXBySlug(slug.toLowerCase())`
 * still returns null → `notFound()` normally for a lowercase slug that
 * doesn't exist.
 *
 * Deliberately in middleware, not a page-level `redirect()`/
 * `permanentRedirect()` call: every one of these three routes has a
 * `loading.tsx` sibling, which wraps the page in a Suspense boundary — Next
 * then streams a 200 shell *before* a page-level redirect call can commit an
 * HTTP-level redirect status (verified directly: curl saw HTTP 200 with the
 * redirect instruction only inside the RSC payload, invisible to non-JS
 * clients/crawlers and to a plain status-code check). Middleware runs before
 * any of that, so it's the one place that can actually set a real 308 here —
 * and it preserves the query string for free (only `url.pathname` changes).
 */
export function needsSlugCanonicalization(slug: string): boolean {
  return slug !== slug.toLowerCase();
}
