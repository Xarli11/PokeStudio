import type { ExploreDataset } from './types';

export interface ValidationIssue {
  recordId: string;
  message: string;
}

/**
 * Validates dataset invariants (DATA_SOURCES.md "Validation examples",
 * ADR-0010). Returns an empty array when the dataset is valid.
 */
export function validateExploreDataset(dataset: ExploreDataset): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const seenSpeciesSlugs = new Set<string>();
  const seenDexNumbers = new Set<number>();
  for (const species of dataset.species) {
    if (seenSpeciesSlugs.has(species.slug)) {
      issues.push({ recordId: species.slug, message: 'Duplicate species slug.' });
    }
    seenSpeciesSlugs.add(species.slug);

    if (seenDexNumbers.has(species.nationalDexNumber)) {
      issues.push({
        recordId: species.slug,
        message: `Duplicate national dex number ${species.nationalDexNumber}.`,
      });
    }
    seenDexNumbers.add(species.nationalDexNumber);

    if (!species.name.en.trim() || !species.name.es.trim()) {
      issues.push({ recordId: species.slug, message: 'Missing localized name for en or es.' });
    }
  }

  const seenFormSlugs = new Set<string>();
  const defaultFormCountBySpecies = new Map<string, number>();
  for (const form of dataset.forms) {
    if (seenFormSlugs.has(form.slug)) {
      issues.push({ recordId: form.slug, message: 'Duplicate form slug.' });
    }
    seenFormSlugs.add(form.slug);

    if (!seenSpeciesSlugs.has(form.speciesSlug)) {
      issues.push({
        recordId: form.slug,
        message: `References unknown species slug "${form.speciesSlug}".`,
      });
    }

    if (form.types.length === 0 || form.types.length > 2) {
      issues.push({
        recordId: form.slug,
        message: `Form must have 1-2 types, got ${form.types.length}.`,
      });
    }

    if (!form.name.en.trim() || !form.name.es.trim()) {
      issues.push({ recordId: form.slug, message: 'Missing localized name for en or es.' });
    }

    const statValues = Object.values(form.baseStats);
    if (statValues.some((value) => value <= 0)) {
      issues.push({ recordId: form.slug, message: 'Base stats must be positive.' });
    }

    if (form.isDefault) {
      defaultFormCountBySpecies.set(
        form.speciesSlug,
        (defaultFormCountBySpecies.get(form.speciesSlug) ?? 0) + 1,
      );
    }
  }

  for (const species of dataset.species) {
    const defaultCount = defaultFormCountBySpecies.get(species.slug) ?? 0;
    if (defaultCount !== 1) {
      issues.push({
        recordId: species.slug,
        message: `Species must have exactly one default form, found ${defaultCount}.`,
      });
    }
  }

  if (!dataset.provenance.sourceId || !dataset.provenance.sourceUrl) {
    issues.push({ recordId: '<dataset>', message: 'Dataset provenance is incomplete.' });
  }

  return issues;
}
