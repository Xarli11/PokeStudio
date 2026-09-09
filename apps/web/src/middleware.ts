import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { defaultLocale, isLocale, locales } from '@pokestudio/i18n';

const LOCALE_COOKIE = 'NEXT_LOCALE';

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
  if (pathnameHasLocale) return NextResponse.next();

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
