/**
 * Generated Supabase types are authoritative (Phase 1B).
 *
 * Phase 1A hand-maintained a subset of this file and hit real `never`-
 * inference bugs from small omissions (a missing `Relationships: []`,
 * missing `Views`/`Functions`/`Enums`/`CompositeTypes`). Now that the schema
 * has real constraints and two migrations, manual sync risk outweighs the
 * convenience of not running a generator — regenerate instead of hand-editing:
 *
 *   pnpm --filter @pokestudio/database exec supabase gen types typescript --local > src/generated-database-types.ts
 *
 * This file only re-exports it — not a wrapper, just the one place the rest
 * of the package imports `Database` from, so call sites don't need to know
 * the type is generated.
 */
export type { Database } from './generated-database-types';
