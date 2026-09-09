import type { MetadataRoute } from 'next';

import { locales } from '@pokestudio/i18n';

const SITE_URL = 'https://pokestudio.app';

export default function sitemap(): MetadataRoute.Sitemap {
  return locales.map((locale) => ({
    url: `${SITE_URL}/${locale}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
  }));
}
