import { describe, expect, it } from 'vitest';

import {
  POKESPRITE_AUDIT_SNAPSHOT,
  auditBoxDexRangeCoverage,
  auditGameEraCoverage,
  auditModernCoverage,
} from './sprite-coverage-audit';

const SAMPLE_SPECIES = [
  { nationalDexNumber: 25 }, // Pikachu — Gen I
  { nationalDexNumber: 151 }, // Mew — Gen I
  { nationalDexNumber: 445 }, // Garchomp — Gen IV
  { nationalDexNumber: 906 }, // Sprigatito — Gen IX
  { nationalDexNumber: 1000 }, // Gholdengo — Gen IX
];

describe('auditModernCoverage', () => {
  it('reports full coverage for every given species, including Generation IX', () => {
    expect(auditModernCoverage(SAMPLE_SPECIES)).toEqual({
      coveredSpeciesCount: 5,
      totalSpeciesCount: 5,
    });
  });
});

describe('auditBoxDexRangeCoverage', () => {
  it("separates species within PokéSprite's audited Dex range from Generation IX (zero coverage)", () => {
    const result = auditBoxDexRangeCoverage(SAMPLE_SPECIES);
    expect(result).toEqual({
      withinAuditedRange: 3, // Pikachu, Mew, Garchomp
      totalSpeciesCount: 5,
      generationIxCount: 2, // Sprigatito, Gholdengo
    });
  });
});

describe('auditGameEraCoverage', () => {
  it('only counts a species as covered by a game whose own generation is at least its own', () => {
    const results = auditGameEraCoverage(SAMPLE_SPECIES);
    const redBlue = results.find((r) => r.versionGroupSlug === 'red-blue')!;
    // Only Pikachu + Mew (Gen I) — Garchomp (Gen IV) and both Gen IX species excluded.
    expect(redBlue.coveredSpeciesCount).toBe(2);
    expect(redBlue.totalSpeciesCount).toBe(5);

    const platinum = results.find((r) => r.versionGroupSlug === 'platinum')!;
    // Pikachu, Mew, Garchomp (Gen I-IV) — both Gen IX species still excluded.
    expect(platinum.coveredSpeciesCount).toBe(3);

    const scarletViolet = results.find((r) => r.versionGroupSlug === 'scarlet-violet')!;
    // Every sample species, including both Gen IX ones.
    expect(scarletViolet.coveredSpeciesCount).toBe(5);
  });

  it('never lists a version group with no audited sprite folder (e.g. Sword/Shield, Sun/Moon)', () => {
    const slugs = auditGameEraCoverage(SAMPLE_SPECIES).map((r) => r.versionGroupSlug);
    expect(slugs).not.toContain('sword-shield');
    expect(slugs).not.toContain('sun-moon');
  });
});

describe('POKESPRITE_AUDIT_SNAPSHOT', () => {
  it('records zero Generation IX coverage — not merely partial', () => {
    expect(POKESPRITE_AUDIT_SNAPSHOT.generationIxSpeciesCovered).toBe(0);
    expect(POKESPRITE_AUDIT_SNAPSHOT.generationIxSpeciesCount).toBeGreaterThan(0);
  });

  it('is dated, so a reader can tell whether it needs refreshing', () => {
    expect(POKESPRITE_AUDIT_SNAPSHOT.auditedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
