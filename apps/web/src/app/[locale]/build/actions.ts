'use server';

import {
  getFormLearnsetAllVersionGroups,
  getFormsBySlugs,
  type ComparablePokemonForm,
  type FormLearnsetAllVersionGroups,
} from '@pokelab/database';

import { getPokemonDatabaseClient } from '@/lib/pokemon-database';

/**
 * Build's team roster lives in `localStorage`, not the URL (task: local
 * persistence, not shareable state) — so unlike Compare, the server can't
 * just re-render from the URL on every add/remove. This Server Action is
 * the client editor's one hop back to the database for a member's full
 * reference data (types/abilities/base stats + its whole learnset) once
 * that member's `formSlug` is known, reusing the exact same queries Compare
 * and the Pokémon detail page already use — no new backend logic.
 */
export interface TeamMemberReferenceData {
  forms: ComparablePokemonForm[];
  /** Keyed by formSlug; a slug with no learnset data (shouldn't happen for a real form) is simply absent. */
  learnsets: Record<string, FormLearnsetAllVersionGroups>;
}

export async function fetchTeamMemberReferenceData(
  formSlugs: string[],
): Promise<TeamMemberReferenceData> {
  const uniqueSlugs = [...new Set(formSlugs)];
  if (uniqueSlugs.length === 0) return { forms: [], learnsets: {} };

  const client = getPokemonDatabaseClient();
  const [forms, learnsetEntries] = await Promise.all([
    getFormsBySlugs(client, uniqueSlugs),
    Promise.all(
      uniqueSlugs.map(
        async (slug) => [slug, await getFormLearnsetAllVersionGroups(client, slug)] as const,
      ),
    ),
  ]);

  const learnsets: Record<string, FormLearnsetAllVersionGroups> = {};
  for (const [slug, learnset] of learnsetEntries) {
    if (learnset) learnsets[slug] = learnset;
  }
  return { forms, learnsets };
}
