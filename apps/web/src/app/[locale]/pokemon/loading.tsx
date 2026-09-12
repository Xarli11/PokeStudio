import { cookies } from 'next/headers';

import { defaultLocale, getDictionary, isLocale } from '@pokestudio/i18n';

import { Skeleton } from '@/components/ui/skeleton';

/**
 * A light placeholder while `listSpeciesPage` resolves (Part K) — not a
 * full skeleton mirroring every card, just enough shape to avoid a blank
 * page. `loading.tsx` gets no route params, so the locale comes from the
 * `NEXT_LOCALE` cookie the middleware/locale switcher already set.
 */
export default async function Loading() {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get('NEXT_LOCALE')?.value;
  const locale = cookieLocale && isLocale(cookieLocale) ? cookieLocale : defaultLocale;
  const dictionary = getDictionary(locale);

  return (
    <div aria-live="polite" aria-busy="true" className="mx-auto flex max-w-wide flex-col gap-8">
      <span className="sr-only">{dictionary.pokedex.loading}</span>
      <Skeleton className="h-8 w-40 rounded-md" />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={index} className="h-22 rounded-md" />
        ))}
      </div>
    </div>
  );
}
