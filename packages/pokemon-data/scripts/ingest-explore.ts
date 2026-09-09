/**
 * Phase 1A ingestion: the first real (non-spike) PokeStudio dataset.
 *
 * Fetches three deliberately structurally-challenging representative species
 * from PokéAPI — Bulbasaur (a normal single-form species), Rotom (multiple
 * meaningful battle-relevant forms with identical stats but different
 * types), and Meowth (regional forms with *different* types AND base stats)
 * — normalizes them into the PokeStudio species/form model (ADR-0010),
 * validates dataset invariants, and writes a versioned, provenance-tagged
 * JSON artifact.
 *
 * This is a one-time/offline script, not a runtime dependency — the web app
 * never calls PokéAPI on a normal page request (CLAUDE.md §10). Its output
 * is what `packages/database/supabase/seed.sql` mirrors for local dev.
 *
 * Run with: pnpm --filter @pokestudio/pokemon-data ingest:explore
 */
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { normalizeForm, normalizeSpecies } from '../src/normalize';
import { fetchPokemon, fetchPokemonForm, fetchPokemonSpecies } from '../src/pokeapi-client';
import type { ExploreDataset, FormCategory, NormalizedForm, NormalizedSpecies } from '../src/types';
import { validateExploreDataset } from '../src/validate';

const SOURCE_ID = 'pokeapi';

interface FormManifestEntry {
  slug: string;
  pokemonId: number;
  isDefault: boolean;
  category: FormCategory;
  regionLabel?: string;
}

interface SpeciesManifestEntry {
  slug: string;
  pokemonSpeciesId: number;
  forms: FormManifestEntry[];
}

/**
 * PokeStudio's own canonical slugs and form categorization — declared here,
 * not derived from PokéAPI, so identity ownership doesn't drift with
 * upstream naming (ADR-0010).
 */
const MANIFEST: SpeciesManifestEntry[] = [
  {
    slug: 'bulbasaur',
    pokemonSpeciesId: 1,
    forms: [{ slug: 'bulbasaur', pokemonId: 1, isDefault: true, category: 'default' }],
  },
  {
    slug: 'rotom',
    pokemonSpeciesId: 479,
    forms: [
      { slug: 'rotom', pokemonId: 479, isDefault: true, category: 'default' },
      { slug: 'rotom-heat', pokemonId: 10008, isDefault: false, category: 'battle' },
      { slug: 'rotom-wash', pokemonId: 10009, isDefault: false, category: 'battle' },
      { slug: 'rotom-frost', pokemonId: 10010, isDefault: false, category: 'battle' },
      { slug: 'rotom-fan', pokemonId: 10011, isDefault: false, category: 'battle' },
      { slug: 'rotom-mow', pokemonId: 10012, isDefault: false, category: 'battle' },
    ],
  },
  {
    slug: 'meowth',
    pokemonSpeciesId: 52,
    forms: [
      { slug: 'meowth', pokemonId: 52, isDefault: true, category: 'default' },
      {
        slug: 'meowth-alola',
        pokemonId: 10107,
        isDefault: false,
        category: 'regional',
        regionLabel: 'Alola',
      },
      {
        slug: 'meowth-galar',
        pokemonId: 10161,
        isDefault: false,
        category: 'regional',
        regionLabel: 'Galar',
      },
    ],
  },
];

async function ingestSpecies(
  manifestEntry: SpeciesManifestEntry,
): Promise<{ species: NormalizedSpecies; forms: NormalizedForm[] }> {
  const rawSpecies = await fetchPokemonSpecies(manifestEntry.pokemonSpeciesId);
  const species = normalizeSpecies({
    species: rawSpecies,
    slug: manifestEntry.slug,
    sourceId: SOURCE_ID,
  });

  const forms = await Promise.all(
    manifestEntry.forms.map(async (formEntry) => {
      const pokemon = await fetchPokemon(formEntry.pokemonId);
      const form = formEntry.isDefault ? undefined : await fetchPokemonForm(pokemon.forms[0]!.url);

      return normalizeForm({
        pokemon,
        form,
        slug: formEntry.slug,
        speciesSlug: species.slug,
        speciesName: species.name,
        isDefault: formEntry.isDefault,
        category: formEntry.category,
        regionLabel: formEntry.regionLabel,
        sourceId: SOURCE_ID,
      });
    }),
  );

  return { species, forms };
}

async function main() {
  const results = await Promise.all(MANIFEST.map(ingestSpecies));

  const dataset: ExploreDataset = {
    provenance: {
      sourceId: SOURCE_ID,
      sourceUrl: 'https://pokeapi.co/api/v2',
      license: 'BSD-3-Clause (PokéAPI data license)',
      fetchedAt: new Date().toISOString(),
      importerVersion: '0.2.0-phase-1a',
    },
    species: results.map((r) => r.species),
    forms: results.flatMap((r) => r.forms),
  };

  const issues = validateExploreDataset(dataset);
  if (issues.length > 0) {
    console.error('Validation failed:', issues);
    process.exitCode = 1;
    return;
  }

  const outDir = path.join(fileURLToPath(new URL('.', import.meta.url)), '..', 'data');
  const outFile = path.join(outDir, 'explore-species.json');
  await writeFile(outFile, `${JSON.stringify(dataset, null, 2)}\n`, 'utf-8');
  console.warn(
    `Wrote ${dataset.species.length} species / ${dataset.forms.length} forms to ${outFile}`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
