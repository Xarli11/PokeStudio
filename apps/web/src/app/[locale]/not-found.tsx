import Link from 'next/link';
import { cookies } from 'next/headers';

import { defaultLocale, getDictionary, isLocale } from '@pokelab/i18n';

import { buttonClass } from '@/lib/ui-classes';

/**
 * Replaces Next.js's bare default 404 for every `notFound()` call under
 * `[locale]` (an unknown species slug, an unknown locale segment) — Part K.
 * Reads locale from the `NEXT_LOCALE` cookie rather than `params`, matching
 * `loading.tsx` (a not-found boundary isn't guaranteed the dynamic segment's
 * params in every Next.js version).
 */
export default async function NotFound() {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get('NEXT_LOCALE')?.value;
  const locale = cookieLocale && isLocale(cookieLocale) ? cookieLocale : defaultLocale;
  const dictionary = getDictionary(locale);

  return (
    <div className="mx-auto flex max-w-text flex-col items-start gap-3 py-8">
      <h1 className="m-0 text-2xl">{dictionary.notFound.title}</h1>
      <p className="m-0 text-muted">{dictionary.notFound.description}</p>
      <Link href={`/${locale}/pokemon`} className={buttonClass('primary')}>
        {dictionary.notFound.backLink}
      </Link>
    </div>
  );
}
