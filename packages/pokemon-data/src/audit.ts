import type { LocalizationNote } from './normalize';
import type { ValidationIssue } from './validate';
import type { FormCategory, NormalizedDataset } from './types';

/**
 * Classification/data-quality audit over a normalized dataset (Phase 1B §6).
 * Pure — takes already-computed inputs, makes no network/DB calls, so it can
 * run standalone against a cached normalization (the `audit` script) without
 * re-fetching or re-touching the database.
 */
export interface AuditReport {
  totalSpecies: number;
  totalForms: number;
  formsByCategory: Record<FormCategory, number>;
  speciesWithMultipleForms: number;
  largestFormFamilies: { speciesSlug: string; formCount: number }[];
  localization: {
    /** Non-default forms only — the default form's name is always the species name, trivially fine. */
    totalNonDefaultForms: number;
    apiSourced: number;
    /** Correct-by-design composed name ("{species} de {region}") — not a data-quality gap. */
    composedRegional: number;
    /** Genuine PokéAPI gap: neither `names` nor `form_names` had this language. */
    composedFallback: number;
    fallbackFormSlugs: string[];
  };
  abilities: {
    totalAbilities: number;
    totalFormAbilityLinks: number;
    hiddenAbilityLinks: number;
    /** Abilities missing a Spanish name/effect entirely from PokéAPI — never invented. */
    missingSpanishName: number;
    missingSpanishEffect: number;
    /** Abilities referenced by more than one form — proves the join, not per-form duplication. */
    sharedAcrossMultipleForms: number;
  };
  evolutions: {
    totalEdges: number;
    totalChains: number;
    speciesWithNoEvolution: number;
    branchingSpecies: { speciesSlug: string; branchCount: number }[];
    multiConditionEdges: {
      fromSpeciesSlug: string;
      toSpeciesSlug: string;
      conditionCount: number;
    }[];
  };
  moves: {
    totalMoves: number;
    missingSpanishName: number;
    missingSpanishEffect: number;
    byDamageClass: Record<string, number>;
  };
  learnsets: {
    totalVersionGroups: number;
    totalLearnMethods: number;
    totalEntries: number;
    totalMachines: number;
    byLearnMethod: Record<string, number>;
    /** Same (form,move,versionGroup,method) at >1 distinct level — a real mechanic (docs/adr/0013), not a data-quality issue. */
    multiLevelKeyCount: number;
  };
  validationIssueCount: number;
  validationIssuesSample: ValidationIssue[];
}

const MAX_LISTED = 20;

export function buildAuditReport(params: {
  dataset: NormalizedDataset;
  localizationNotes: LocalizationNote[];
  validationIssues: ValidationIssue[];
}): AuditReport {
  const { dataset, localizationNotes, validationIssues } = params;

  const formsBySpecies = new Map<string, number>();
  const formsByCategory: Record<FormCategory, number> = {
    default: 0,
    regional: 0,
    battle: 0,
    cosmetic: 0,
  };
  for (const form of dataset.forms) {
    formsBySpecies.set(form.speciesSlug, (formsBySpecies.get(form.speciesSlug) ?? 0) + 1);
    formsByCategory[form.category] = (formsByCategory[form.category] ?? 0) + 1;
  }

  const largestFormFamilies = [...formsBySpecies.entries()]
    .map(([speciesSlug, formCount]) => ({ speciesSlug, formCount }))
    .sort((a, b) => b.formCount - a.formCount)
    .slice(0, MAX_LISTED);

  const composedRegional = localizationNotes.filter(
    (n) => n.esSource === 'composed-regional',
  ).length;
  const composedFallback = localizationNotes.filter((n) => n.esSource === 'composed-fallback');

  const formCountByAbility = new Map<string, number>();
  let hiddenAbilityLinks = 0;
  for (const formAbility of dataset.formAbilities) {
    formCountByAbility.set(
      formAbility.abilitySlug,
      (formCountByAbility.get(formAbility.abilitySlug) ?? 0) + 1,
    );
    if (formAbility.isHidden) hiddenAbilityLinks++;
  }

  const speciesTouchedByEvolution = new Set<string>();
  const branchCountBySpecies = new Map<string, number>();
  const edgeGroupCounts = new Map<string, number>();
  const chainIds = new Set<string>();
  for (const evolution of dataset.evolutions) {
    chainIds.add(evolution.chainExternalId);
    speciesTouchedByEvolution.add(evolution.fromSpeciesSlug);
    speciesTouchedByEvolution.add(evolution.toSpeciesSlug);
    const edgeKey = `${evolution.fromSpeciesSlug}->${evolution.toSpeciesSlug}`;
    edgeGroupCounts.set(edgeKey, (edgeGroupCounts.get(edgeKey) ?? 0) + 1);
  }
  const distinctToSpeciesByFrom = new Map<string, Set<string>>();
  for (const evolution of dataset.evolutions) {
    const set = distinctToSpeciesByFrom.get(evolution.fromSpeciesSlug) ?? new Set<string>();
    set.add(evolution.toSpeciesSlug);
    distinctToSpeciesByFrom.set(evolution.fromSpeciesSlug, set);
  }
  for (const [speciesSlug, targets] of distinctToSpeciesByFrom) {
    branchCountBySpecies.set(speciesSlug, targets.size);
  }
  const branchingSpecies = [...branchCountBySpecies.entries()]
    .filter(([, branchCount]) => branchCount > 1)
    .map(([speciesSlug, branchCount]) => ({ speciesSlug, branchCount }))
    .sort((a, b) => b.branchCount - a.branchCount)
    .slice(0, MAX_LISTED);
  const multiConditionEdges = [...edgeGroupCounts.entries()]
    .filter(([, conditionCount]) => conditionCount > 1)
    .map(([edgeKey, conditionCount]) => {
      const [fromSpeciesSlug, toSpeciesSlug] = edgeKey.split('->');
      return { fromSpeciesSlug: fromSpeciesSlug!, toSpeciesSlug: toSpeciesSlug!, conditionCount };
    })
    .slice(0, MAX_LISTED);

  const byDamageClass: Record<string, number> = {};
  for (const move of dataset.moves) {
    byDamageClass[move.damageClass] = (byDamageClass[move.damageClass] ?? 0) + 1;
  }

  const byLearnMethod: Record<string, number> = {};
  const levelsByNaturalKeyPrefix = new Map<string, Set<number>>();
  for (const entry of dataset.learnsetEntries) {
    byLearnMethod[entry.learnMethodSlug] = (byLearnMethod[entry.learnMethodSlug] ?? 0) + 1;
    const prefixKey = `${entry.formSlug}:${entry.moveSlug}:${entry.versionGroupSlug}:${entry.learnMethodSlug}`;
    const levels = levelsByNaturalKeyPrefix.get(prefixKey) ?? new Set<number>();
    levels.add(entry.level);
    levelsByNaturalKeyPrefix.set(prefixKey, levels);
  }
  const multiLevelKeyCount = [...levelsByNaturalKeyPrefix.values()].filter(
    (levels) => levels.size > 1,
  ).length;

  return {
    totalSpecies: dataset.species.length,
    totalForms: dataset.forms.length,
    formsByCategory,
    speciesWithMultipleForms: [...formsBySpecies.values()].filter((count) => count > 1).length,
    largestFormFamilies,
    localization: {
      totalNonDefaultForms: dataset.forms.length - dataset.species.length,
      apiSourced: dataset.forms.length - dataset.species.length - localizationNotes.length,
      composedRegional,
      composedFallback: composedFallback.length,
      fallbackFormSlugs: composedFallback.slice(0, MAX_LISTED).map((n) => n.formSlug),
    },
    abilities: {
      totalAbilities: dataset.abilities.length,
      totalFormAbilityLinks: dataset.formAbilities.length,
      hiddenAbilityLinks,
      missingSpanishName: dataset.abilities.filter((a) => !a.nameEs).length,
      missingSpanishEffect: dataset.abilities.filter((a) => !a.effectEs).length,
      sharedAcrossMultipleForms: [...formCountByAbility.values()].filter((count) => count > 1)
        .length,
    },
    evolutions: {
      totalEdges: dataset.evolutions.length,
      totalChains: chainIds.size,
      speciesWithNoEvolution: dataset.species.filter((s) => !speciesTouchedByEvolution.has(s.slug))
        .length,
      branchingSpecies,
      multiConditionEdges,
    },
    moves: {
      totalMoves: dataset.moves.length,
      missingSpanishName: dataset.moves.filter((m) => !m.nameEs).length,
      missingSpanishEffect: dataset.moves.filter((m) => !m.effectEs).length,
      byDamageClass,
    },
    learnsets: {
      totalVersionGroups: dataset.versionGroups.length,
      totalLearnMethods: dataset.learnMethods.length,
      totalEntries: dataset.learnsetEntries.length,
      totalMachines: dataset.machines.length,
      byLearnMethod,
      multiLevelKeyCount,
    },
    validationIssueCount: validationIssues.length,
    validationIssuesSample: validationIssues.slice(0, MAX_LISTED),
  };
}

export function formatAuditReport(report: AuditReport): string {
  const lines: string[] = [];
  lines.push('=== PokeStudio ingestion audit ===');
  lines.push(`Species: ${report.totalSpecies}`);
  lines.push(`Forms: ${report.totalForms}`);
  lines.push(`Species with >1 form: ${report.speciesWithMultipleForms}`);
  lines.push('');
  lines.push('Forms by category:');
  for (const [category, count] of Object.entries(report.formsByCategory)) {
    lines.push(`  ${category}: ${count}`);
  }
  lines.push('');
  lines.push(`Largest form families (top ${report.largestFormFamilies.length}):`);
  for (const { speciesSlug, formCount } of report.largestFormFamilies) {
    lines.push(`  ${speciesSlug}: ${formCount} forms`);
  }
  lines.push('');
  lines.push('Localization (non-default form Spanish names):');
  lines.push(`  from PokéAPI directly: ${report.localization.apiSourced}`);
  lines.push(
    `  composed (regional "{species} de {region}", by design): ${report.localization.composedRegional}`,
  );
  lines.push(
    `  composed (fallback — genuine PokéAPI gap): ${report.localization.composedFallback}`,
  );
  if (report.localization.fallbackFormSlugs.length > 0) {
    lines.push(`    e.g. ${report.localization.fallbackFormSlugs.join(', ')}`);
  }
  lines.push('');
  lines.push('Abilities:');
  lines.push(`  total abilities: ${report.abilities.totalAbilities}`);
  lines.push(`  form/ability links: ${report.abilities.totalFormAbilityLinks}`);
  lines.push(`  hidden-ability links: ${report.abilities.hiddenAbilityLinks}`);
  lines.push(`  abilities shared across >1 form: ${report.abilities.sharedAcrossMultipleForms}`);
  lines.push(`  abilities missing a Spanish name: ${report.abilities.missingSpanishName}`);
  lines.push(`  abilities missing a Spanish effect: ${report.abilities.missingSpanishEffect}`);
  lines.push('');
  lines.push('Evolutions:');
  lines.push(`  total edges: ${report.evolutions.totalEdges}`);
  lines.push(`  total chains: ${report.evolutions.totalChains}`);
  lines.push(`  species with no evolution (isolated): ${report.evolutions.speciesWithNoEvolution}`);
  lines.push(`  branching species (top ${report.evolutions.branchingSpecies.length}):`);
  for (const { speciesSlug, branchCount } of report.evolutions.branchingSpecies) {
    lines.push(`    ${speciesSlug}: ${branchCount} branches`);
  }
  if (report.evolutions.multiConditionEdges.length > 0) {
    lines.push(
      `  edges with multiple alternative conditions (top ${report.evolutions.multiConditionEdges.length}):`,
    );
    for (const edge of report.evolutions.multiConditionEdges) {
      lines.push(
        `    ${edge.fromSpeciesSlug} -> ${edge.toSpeciesSlug}: ${edge.conditionCount} methods`,
      );
    }
  }
  lines.push('');
  lines.push('Moves:');
  lines.push(`  total moves: ${report.moves.totalMoves}`);
  for (const [damageClass, count] of Object.entries(report.moves.byDamageClass)) {
    lines.push(`    ${damageClass}: ${count}`);
  }
  lines.push(`  moves missing a Spanish name: ${report.moves.missingSpanishName}`);
  lines.push(`  moves missing a Spanish effect: ${report.moves.missingSpanishEffect}`);
  lines.push('');
  lines.push('Learnsets:');
  lines.push(`  version groups: ${report.learnsets.totalVersionGroups}`);
  lines.push(`  learn methods: ${report.learnsets.totalLearnMethods}`);
  lines.push(
    `  learnset entries (form/move/version-group/method/level rows): ${report.learnsets.totalEntries}`,
  );
  lines.push(`  machines (TM/HM/TR identities): ${report.learnsets.totalMachines}`);
  lines.push(
    `  same (form,move,version-group,method) at >1 level (real relearn mechanic): ${report.learnsets.multiLevelKeyCount}`,
  );
  lines.push('  entries by learn method:');
  for (const [method, count] of Object.entries(report.learnsets.byLearnMethod)) {
    lines.push(`    ${method}: ${count}`);
  }
  lines.push('');
  lines.push(`Validation issues: ${report.validationIssueCount}`);
  for (const issue of report.validationIssuesSample) {
    lines.push(`  [${issue.recordId}] ${issue.message}`);
  }
  return lines.join('\n');
}
