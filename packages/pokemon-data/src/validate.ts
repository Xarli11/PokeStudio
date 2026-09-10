import type { FormCategory, NormalizedDataset, PokemonType } from './types';

export interface ValidationIssue {
  recordId: string;
  message: string;
}

const KNOWN_FORM_CATEGORIES: readonly FormCategory[] = [
  'default',
  'regional',
  'battle',
  'cosmetic',
];
const KNOWN_TYPES: ReadonlySet<PokemonType> = new Set<PokemonType>([
  'normal',
  'fire',
  'water',
  'electric',
  'grass',
  'ice',
  'fighting',
  'poison',
  'ground',
  'flying',
  'psychic',
  'bug',
  'rock',
  'ghost',
  'dragon',
  'dark',
  'steel',
  'fairy',
]);
const STAT_KEYS = ['hp', 'attack', 'defense', 'specialAttack', 'specialDefense', 'speed'] as const;

/**
 * Validates dataset invariants (Phase 1B §9, ADR-0010). Returns an empty
 * array when the dataset is valid. Never repairs bad data — callers must
 * fail ingestion (or explicitly, visibly accept a known/reviewed warning),
 * never silently drop or "fix" a malformed record.
 */
export function validateExploreDataset(dataset: NormalizedDataset): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const seenSpeciesSlugs = new Set<string>();
  const seenDexNumbers = new Set<number>();
  const seenSpeciesExternalIds = new Set<string>();
  for (const species of dataset.species) {
    if (seenSpeciesSlugs.has(species.slug)) {
      issues.push({ recordId: species.slug, message: 'Duplicate species slug.' });
    }
    seenSpeciesSlugs.add(species.slug);

    if (!Number.isInteger(species.nationalDexNumber) || species.nationalDexNumber < 1) {
      issues.push({
        recordId: species.slug,
        message: `Invalid national dex number ${species.nationalDexNumber}.`,
      });
    } else if (seenDexNumbers.has(species.nationalDexNumber)) {
      issues.push({
        recordId: species.slug,
        message: `Duplicate national dex number ${species.nationalDexNumber}.`,
      });
    }
    seenDexNumbers.add(species.nationalDexNumber);

    if (!species.name.en.trim() || !species.name.es.trim()) {
      issues.push({ recordId: species.slug, message: 'Missing localized name for en or es.' });
    }

    if (!species.source.sourceId || !species.source.externalId) {
      issues.push({ recordId: species.slug, message: 'Missing provenance (source/external id).' });
    } else {
      const externalKey = `${species.source.sourceId}:${species.source.externalId}`;
      if (seenSpeciesExternalIds.has(externalKey)) {
        issues.push({
          recordId: species.slug,
          message: `External identity collision: another species already uses ${externalKey}.`,
        });
      }
      seenSpeciesExternalIds.add(externalKey);
    }
  }

  const seenFormSlugs = new Set<string>();
  const seenFormExternalIds = new Set<string>();
  const defaultFormCountBySpecies = new Map<string, number>();
  for (const form of dataset.forms) {
    if (seenFormSlugs.has(form.slug)) {
      issues.push({ recordId: form.slug, message: 'Duplicate form slug.' });
    }
    seenFormSlugs.add(form.slug);

    // Orphan check: every form must belong to exactly one known species —
    // an unresolved speciesSlug means this record must never reach persistence.
    if (!seenSpeciesSlugs.has(form.speciesSlug)) {
      issues.push({
        recordId: form.slug,
        message: `Orphan form: references unknown species slug "${form.speciesSlug}".`,
      });
    }

    if (form.types.length === 0 || form.types.length > 2) {
      issues.push({
        recordId: form.slug,
        message: `Form must have 1-2 types, got ${form.types.length}.`,
      });
    }
    for (const type of form.types) {
      if (!KNOWN_TYPES.has(type)) {
        issues.push({ recordId: form.slug, message: `Unknown type "${type}".` });
      }
    }

    if (!KNOWN_FORM_CATEGORIES.includes(form.category)) {
      issues.push({ recordId: form.slug, message: `Unknown form category "${form.category}".` });
    }

    if (!form.name.en.trim() || !form.name.es.trim()) {
      issues.push({ recordId: form.slug, message: 'Missing localized name for en or es.' });
    }

    for (const key of STAT_KEYS) {
      const value = form.baseStats[key];
      if (!Number.isFinite(value) || value <= 0) {
        issues.push({
          recordId: form.slug,
          message: `Base stat "${key}" must be a positive number, got ${value}.`,
        });
      }
    }

    if (!form.source.sourceId || !form.source.externalId) {
      issues.push({ recordId: form.slug, message: 'Missing provenance (source/external id).' });
    } else {
      const externalKey = `${form.source.sourceId}:${form.source.externalId}`;
      if (seenFormExternalIds.has(externalKey)) {
        issues.push({
          recordId: form.slug,
          message: `External identity collision: another form already uses ${externalKey}.`,
        });
      }
      seenFormExternalIds.add(externalKey);
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

  const seenAbilitySlugs = new Set<string>();
  const seenAbilityExternalIds = new Set<string>();
  for (const ability of dataset.abilities) {
    if (seenAbilitySlugs.has(ability.slug)) {
      issues.push({ recordId: ability.slug, message: 'Duplicate ability slug.' });
    }
    seenAbilitySlugs.add(ability.slug);

    if (!ability.nameEn.trim()) {
      issues.push({ recordId: ability.slug, message: 'Missing English ability name.' });
    }

    if (!ability.source.sourceId || !ability.source.externalId) {
      issues.push({ recordId: ability.slug, message: 'Missing provenance (source/external id).' });
    } else {
      const externalKey = `${ability.source.sourceId}:${ability.source.externalId}`;
      if (seenAbilityExternalIds.has(externalKey)) {
        issues.push({
          recordId: ability.slug,
          message: `External identity collision: another ability already uses ${externalKey}.`,
        });
      }
      seenAbilityExternalIds.add(externalKey);
    }
  }

  const seenFormAbilitySlots = new Set<string>();
  for (const formAbility of dataset.formAbilities) {
    const recordId = `${formAbility.formSlug}:${formAbility.abilitySlug}`;

    if (!seenFormSlugs.has(formAbility.formSlug)) {
      issues.push({
        recordId,
        message: `Orphan form ability: references unknown form slug "${formAbility.formSlug}".`,
      });
    }
    if (!seenAbilitySlugs.has(formAbility.abilitySlug)) {
      issues.push({
        recordId,
        message: `Orphan form ability: references unknown ability slug "${formAbility.abilitySlug}".`,
      });
    }

    const slotKey = `${formAbility.formSlug}:${formAbility.slot}`;
    if (seenFormAbilitySlots.has(slotKey)) {
      issues.push({
        recordId,
        message: `Duplicate ability slot ${formAbility.slot} for form "${formAbility.formSlug}".`,
      });
    }
    seenFormAbilitySlots.add(slotKey);

    if (!Number.isInteger(formAbility.slot) || formAbility.slot < 1) {
      issues.push({ recordId, message: `Invalid ability slot ${formAbility.slot}.` });
    }
  }

  for (const evolution of dataset.evolutions) {
    const recordId = `${evolution.fromSpeciesSlug}->${evolution.toSpeciesSlug}`;

    if (!seenSpeciesSlugs.has(evolution.fromSpeciesSlug)) {
      issues.push({
        recordId,
        message: `Orphan evolution: references unknown species slug "${evolution.fromSpeciesSlug}".`,
      });
    }
    if (!seenSpeciesSlugs.has(evolution.toSpeciesSlug)) {
      issues.push({
        recordId,
        message: `Orphan evolution: references unknown species slug "${evolution.toSpeciesSlug}".`,
      });
    }
    if (evolution.fromSpeciesSlug === evolution.toSpeciesSlug) {
      issues.push({ recordId, message: 'Evolution edge cannot point a species to itself.' });
    }
    if (!evolution.trigger.trim()) {
      issues.push({ recordId, message: 'Missing evolution trigger.' });
    }
    if (!evolution.chainExternalId.trim()) {
      issues.push({ recordId, message: 'Missing evolution chain id.' });
    }
    if (!evolution.source.sourceId) {
      issues.push({ recordId, message: 'Missing provenance (source id).' });
    }
  }

  if (!dataset.provenance.sourceId || !dataset.provenance.sourceUrl) {
    issues.push({ recordId: '<dataset>', message: 'Dataset provenance is incomplete.' });
  }

  return issues;
}
