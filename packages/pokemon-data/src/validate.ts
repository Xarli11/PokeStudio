import type { NormalizedSpecies, ProvenancedDataset } from './types';

export interface ValidationIssue {
  recordId: string;
  message: string;
}

/**
 * Validates dataset invariants (DATA_SOURCES.md "Validation examples").
 * Returns an empty array when the dataset is valid.
 */
export function validateSpeciesDataset(
  dataset: ProvenancedDataset<NormalizedSpecies>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seenIds = new Set<string>();
  const seenDexNumbers = new Set<number>();

  for (const species of dataset.records) {
    if (seenIds.has(species.id)) {
      issues.push({ recordId: species.id, message: 'Duplicate species id.' });
    }
    seenIds.add(species.id);

    if (seenDexNumbers.has(species.nationalDexNumber)) {
      issues.push({
        recordId: species.id,
        message: `Duplicate national dex number ${species.nationalDexNumber}.`,
      });
    }
    seenDexNumbers.add(species.nationalDexNumber);

    if (species.types.length === 0 || species.types.length > 2) {
      issues.push({
        recordId: species.id,
        message: `Species must have 1-2 types, got ${species.types.length}.`,
      });
    }

    if (!species.name.en.trim() || !species.name.es.trim()) {
      issues.push({ recordId: species.id, message: 'Missing localized name for en or es.' });
    }

    const statValues = Object.values(species.baseStats);
    if (statValues.some((value) => value <= 0)) {
      issues.push({ recordId: species.id, message: 'Base stats must be positive.' });
    }

    if (species.introducedInGeneration < 1 || species.introducedInGeneration > 9) {
      issues.push({
        recordId: species.id,
        message: `Generation ${species.introducedInGeneration} out of known range 1-9.`,
      });
    }
  }

  if (!dataset.provenance.sourceId || !dataset.provenance.sourceUrl) {
    issues.push({ recordId: '<dataset>', message: 'Dataset provenance is incomplete.' });
  }

  return issues;
}
