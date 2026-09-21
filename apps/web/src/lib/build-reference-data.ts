import type { Item, Nature, SpeciesSearchAlias, SpeciesSearchItem } from '@pokestudio/database';

/**
 * The Team Editor's deferred, interaction-gated reference data (Fase 2B.2)
 * — everything `/build/[teamId]`'s initial render does NOT need:
 * `searchIndex` only reaches `RosterPicker` (opened by "Add Pokémon"),
 * `natures`/`items` only reach `SetEditor` (opened by "Configure", which
 * itself requires a member to already exist). `versionGroups` is not part
 * of this type — it stays in the initial Server Component render, since
 * the version-group selector is visible immediately.
 *
 * Served by `/api/build-reference-data` (public reference data — no
 * user/team state, same queries `/pokemon` and `/compare` already expose).
 */
export interface BuildReferenceData {
  searchIndex: { items: SpeciesSearchItem[]; aliases: SpeciesSearchAlias[] };
  natures: Nature[];
  items: Item[];
}

/** Loading/ready/error — no richer state machine needed for a single fetch. */
export type BuildReferenceDataState =
  { status: 'loading' } | { status: 'ready'; data: BuildReferenceData } | { status: 'error' };
