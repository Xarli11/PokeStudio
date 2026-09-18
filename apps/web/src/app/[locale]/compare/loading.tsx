import { cookies } from 'next/headers';

import { defaultLocale, getDictionary, isLocale } from '@pokelab/i18n';

import { Skeleton } from '@/components/ui/skeleton';

/** Mirrors `pokemon/loading.tsx`'s shape — see that file for why. */
export default async function Loading() {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get('NEXT_LOCALE')?.value;
  const locale = cookieLocale && isLocale(cookieLocale) ? cookieLocale : defaultLocale;
  const dictionary = getDictionary(locale);

  return (
    <div aria-live="polite" aria-busy="true" className="mx-auto flex max-w-wide flex-col gap-8">
      <span className="sr-only">{dictionary.pokedex.loading}</span>
      <Skeleton className="h-8 w-40 rounded-md" />
      <Skeleton className="h-10 w-72 rounded-md" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 2 }).map((_, index) => (
          <Skeleton key={index} className="h-96 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
