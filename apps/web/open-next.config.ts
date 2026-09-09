import { defineCloudflareConfig } from '@opennextjs/cloudflare';

// Deliberately minimal (Ponytail — no extra infrastructure): no R2/KV
// incremental-cache override. This app has no ISR/ on-demand revalidation
// yet (Pokédex routes are `force-dynamic`; the only static routes are the
// locale-only homepage with no `revalidate`), so the default in-memory
// cache OpenNext falls back to is sufficient. Add an R2-backed cache here
// if/when a route actually needs persistent ISR.
export default defineCloudflareConfig();
