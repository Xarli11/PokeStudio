import { cookies } from 'next/headers';

import { defaultLocale, getDictionary, isLocale } from '@pokestudio/i18n';

import { Skeleton } from '@/components/ui/skeleton';

/** A light placeholder while species/evolution data resolves (Part K) — see `pokemon/loading.tsx`. */
export default async function Loading() {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get('NEXT_LOCALE')?.value;
  const locale = cookieLocale && isLocale(cookieLocale) ? cookieLocale : defaultLocale;
  const dictionary = getDictionary(locale);

  return (
    <div aria-live="polite" aria-busy="true" className="mx-auto flex max-w-detail flex-col gap-6">
      <span className="sr-only">{dictionary.pokedex.loading}</span>
      <Skeleton className="h-4 w-28 rounded-md" />
      <div className="flex items-center gap-4">
        <Skeleton className="h-18 w-18 rounded-full" />
        <Skeleton className="h-8 w-48 rounded-md" />
      </div>
      <Skeleton className="h-40 rounded-md" />
      <Skeleton className="h-25 rounded-md" />
    </div>
  );
}
