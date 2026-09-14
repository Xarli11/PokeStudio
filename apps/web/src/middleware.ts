import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { defaultLocale, isLocale, locales } from '@pokestudio/i18n';

import { needsSlugCanonicalization } from '@/lib/entity-slug';

const LOCALE_COOKIE = 'NEXT_LOCALE';

// Case-insensitive canonical entity routes (Phase 1C.3 §13) — deliberately
// handled in middleware, not in each page component. A page-level
// `redirect()`/`permanentRedirect()` call only produces a real HTTP-level
// redirect when nothing has streamed yet; every one of these three routes
// has a `loading.tsx` sibling, which makes Next wrap the page in a Suspense
// boundary and start streaming a 200 shell *before* the page's own redirect
// call can run — verified directly (curl showed HTTP 200 with the redirect
// only present inside the RSC payload, invisible to non-JS clients/crawlers
// and to a plain status-code check). Middleware runs before any of that, so
// it's the one place that can actually set a top-level 308 here.
const ENTITY_SLUG_ROUTE = /^\/(en|es)\/(pokemon|moves|abilities)\/([^/]+)$/;

function localeFromAcceptLanguage(header: string | null): string {
  if (!header) return defaultLocale;

  const preferred = header
    .split(',')
    .map((part) => part.split(';')[0]?.trim().toLowerCase().split('-')[0])
    .find((lang): lang is string => !!lang && isLocale(lang));

  return preferred ?? defaultLocale;
}

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  const pathnameHasLocale = locales.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
  );
  if (pathnameHasLocale) {
    const entityMatch = ENTITY_SLUG_ROUTE.exec(pathname);
    if (entityMatch) {
      // Non-null: all three groups are mandatory (no "?") in ENTITY_SLUG_ROUTE,
      // so a successful match always populates them.
      const locale = entityMatch[1]!;
      const section = entityMatch[2]!;
      const slug = entityMatch[3]!;
      if (needsSlugCanonicalization(slug)) {
        const url = request.nextUrl.clone();
        url.pathname = `/${locale}/${section}/${slug.toLowerCase()}`;
        // 308 (permanent): canonical slugs are always lowercase by
        // construction (task §13/§17) — this is never a temporary condition.
        return NextResponse.redirect(url, 308);
      }
    }
    return NextResponse.next();
  }

  const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
  const locale =
    cookieLocale && isLocale(cookieLocale)
      ? cookieLocale
      : localeFromAcceptLanguage(request.headers.get('accept-language'));

  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname === '/' ? '' : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next|api|.*\\..*).*)'],
};
