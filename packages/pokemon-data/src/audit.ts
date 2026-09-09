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
  lines.push(`Validation issues: ${report.validationIssueCount}`);
  for (const issue of report.validationIssuesSample) {
    lines.push(`  [${issue.recordId}] ${issue.message}`);
  }
  return lines.join('\n');
}
