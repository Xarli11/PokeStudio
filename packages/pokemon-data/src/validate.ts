import type { DamageClass, FormCategory, MoveStat, NormalizedDataset, PokemonType } from './types';

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
const KNOWN_DAMAGE_CLASSES: readonly DamageClass[] = ['physical', 'special', 'status'];
const KNOWN_MOVE_STATS: ReadonlySet<MoveStat> = new Set<MoveStat>([
  'attack',
  'defense',
  'special-attack',
  'special-defense',
  'speed',
  'accuracy',
  'evasion',
]);

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

  const seenMoveSlugs = new Set<string>();
  const seenMoveExternalIds = new Set<string>();
  for (const move of dataset.moves) {
    if (seenMoveSlugs.has(move.slug)) {
      issues.push({ recordId: move.slug, message: 'Duplicate move slug.' });
    }
    seenMoveSlugs.add(move.slug);

    if (!move.nameEn.trim()) {
      issues.push({ recordId: move.slug, message: 'Missing English move name.' });
    }
    if (!KNOWN_TYPES.has(move.type)) {
      issues.push({ recordId: move.slug, message: `Unknown type "${move.type}".` });
    }
    if (!KNOWN_DAMAGE_CLASSES.includes(move.damageClass)) {
      issues.push({ recordId: move.slug, message: `Unknown damage class "${move.damageClass}".` });
    }
    if (!Number.isInteger(move.pp) || move.pp <= 0) {
      issues.push({
        recordId: move.slug,
        message: `PP must be a positive integer, got ${move.pp}.`,
      });
    }
    if (move.power !== undefined && (!Number.isFinite(move.power) || move.power <= 0)) {
      issues.push({
        recordId: move.slug,
        message: `Power must be null or positive, got ${move.power}.`,
      });
    }
    if (
      move.accuracy !== undefined &&
      (!Number.isFinite(move.accuracy) || move.accuracy < 1 || move.accuracy > 100)
    ) {
      issues.push({
        recordId: move.slug,
        message: `Accuracy must be null or in 1-100, got ${move.accuracy}.`,
      });
    }
    if (!Number.isInteger(move.generation) || move.generation < 1 || move.generation > 9) {
      issues.push({
        recordId: move.slug,
        message: `Move generation must be 1-9, got ${move.generation}.`,
      });
    }
    for (const statChange of move.statChanges) {
      if (!KNOWN_MOVE_STATS.has(statChange.stat)) {
        issues.push({
          recordId: move.slug,
          message: `Unknown stat "${statChange.stat}" in stat_changes.`,
        });
      }
      if (
        !Number.isInteger(statChange.change) ||
        statChange.change === 0 ||
        statChange.change < -6 ||
        statChange.change > 6
      ) {
        issues.push({
          recordId: move.slug,
          message: `Stat change must be a nonzero integer in -6..6, got ${statChange.change}.`,
        });
      }
    }

    if (!move.source.sourceId || !move.source.externalId) {
      issues.push({ recordId: move.slug, message: 'Missing provenance (source/external id).' });
    } else {
      const externalKey = `${move.source.sourceId}:${move.source.externalId}`;
      if (seenMoveExternalIds.has(externalKey)) {
        issues.push({
          recordId: move.slug,
          message: `External identity collision: another move already uses ${externalKey}.`,
        });
      }
      seenMoveExternalIds.add(externalKey);
    }
  }

  const seenVersionGroupSlugs = new Set<string>();
  const seenVersionGroupExternalIds = new Set<string>();
  for (const versionGroup of dataset.versionGroups) {
    if (seenVersionGroupSlugs.has(versionGroup.slug)) {
      issues.push({ recordId: versionGroup.slug, message: 'Duplicate version group slug.' });
    }
    seenVersionGroupSlugs.add(versionGroup.slug);

    if (
      !Number.isInteger(versionGroup.generation) ||
      versionGroup.generation < 1 ||
      versionGroup.generation > 9
    ) {
      issues.push({
        recordId: versionGroup.slug,
        message: `Version group generation must be 1-9, got ${versionGroup.generation}.`,
      });
    }

    const externalKey = `${versionGroup.source.sourceId}:${versionGroup.source.externalId}`;
    if (seenVersionGroupExternalIds.has(externalKey)) {
      issues.push({
        recordId: versionGroup.slug,
        message: `External identity collision: another version group already uses ${externalKey}.`,
      });
    }
    seenVersionGroupExternalIds.add(externalKey);
  }

  const seenLearnMethodSlugs = new Set<string>();
  for (const method of dataset.learnMethods) {
    if (seenLearnMethodSlugs.has(method.slug)) {
      issues.push({ recordId: method.slug, message: 'Duplicate move learn method slug.' });
    }
    seenLearnMethodSlugs.add(method.slug);
  }

  const seenLearnsetNaturalKeys = new Set<string>();
  for (const entry of dataset.learnsetEntries) {
    const recordId = `${entry.formSlug}:${entry.moveSlug}:${entry.versionGroupSlug}:${entry.learnMethodSlug}:${entry.level}`;

    if (!seenFormSlugs.has(entry.formSlug)) {
      issues.push({
        recordId,
        message: `Orphan learnset entry: unknown form "${entry.formSlug}".`,
      });
    }
    if (!seenMoveSlugs.has(entry.moveSlug)) {
      issues.push({
        recordId,
        message: `Orphan learnset entry: unknown move "${entry.moveSlug}".`,
      });
    }
    if (!seenVersionGroupSlugs.has(entry.versionGroupSlug)) {
      issues.push({
        recordId,
        message: `Orphan learnset entry: unknown version group "${entry.versionGroupSlug}".`,
      });
    }
    if (!seenLearnMethodSlugs.has(entry.learnMethodSlug)) {
      issues.push({
        recordId,
        message: `Unknown learn method "${entry.learnMethodSlug}".`,
      });
    }
    if (!Number.isInteger(entry.level) || entry.level < 0) {
      issues.push({
        recordId,
        message: `Level must be a non-negative integer, got ${entry.level}.`,
      });
    }

    if (seenLearnsetNaturalKeys.has(recordId)) {
      issues.push({ recordId, message: 'Duplicate learnset natural key.' });
    }
    seenLearnsetNaturalKeys.add(recordId);
  }

  for (const machine of dataset.machines) {
    const recordId = `${machine.moveSlug}:${machine.versionGroupSlug}`;
    if (!seenMoveSlugs.has(machine.moveSlug)) {
      issues.push({ recordId, message: `Orphan machine: unknown move "${machine.moveSlug}".` });
    }
    if (!seenVersionGroupSlugs.has(machine.versionGroupSlug)) {
      issues.push({
        recordId,
        message: `Orphan machine: unknown version group "${machine.versionGroupSlug}".`,
      });
    }
    if (!machine.itemSlug.trim()) {
      issues.push({ recordId, message: 'Missing machine item slug.' });
    }
  }

  if (!dataset.provenance.sourceId || !dataset.provenance.sourceUrl) {
    issues.push({ recordId: '<dataset>', message: 'Dataset provenance is incomplete.' });
  }

  return issues;
}
