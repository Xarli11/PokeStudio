import type { SpeciesFormDetail } from '@pokelab/database';

export interface PartitionedForms {
  /** Mechanically distinct from the default form (different types or base stats) — get a full detail card. */
  distinctForms: SpeciesFormDetail[];
  /** Pure cosmetic reskins identical in types/stats/abilities to the default — shown as names only. */
  cosmeticVariants: SpeciesFormDetail[];
}

function typesEqual(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((type, index) => type === b[index]);
}

function statsEqual(a: SpeciesFormDetail['baseStats'], b: SpeciesFormDetail['baseStats']): boolean {
  return (
    a.hp === b.hp &&
    a.attack === b.attack &&
    a.defense === b.defense &&
    a.specialAttack === b.specialAttack &&
    a.specialDefense === b.specialDefense &&
    a.speed === b.speed
  );
}

/**
 * Splits a species' non-default forms into ones worth a full detail card
 * (Rotom's appliances, regional forms, Megas — mechanically different) and
 * pure cosmetic reskins that share the default form's types/stats exactly
 * (Alcremie's 63 flavors, Unown's 27 letters, Vivillon's patterns).
 *
 * A full "Types / Base stats / Abilities" card repeated dozens of times for
 * forms that are, mechanically, identical to the one already shown is pure
 * noise — the only thing that actually differs is the name. UX/UI 0.1 Part F
 * ("avoid dumping dozens of chips", "survive extreme cases") requires this
 * to degrade gracefully rather than dumping every form's full stat block.
 */
export function partitionOtherForms(
  defaultForm: SpeciesFormDetail,
  otherForms: readonly SpeciesFormDetail[],
): PartitionedForms {
  const distinctForms: SpeciesFormDetail[] = [];
  const cosmeticVariants: SpeciesFormDetail[] = [];

  for (const form of otherForms) {
    const mechanicallyIdentical =
      form.category === 'cosmetic' &&
      typesEqual(form.types, defaultForm.types) &&
      statsEqual(form.baseStats, defaultForm.baseStats);

    if (mechanicallyIdentical) {
      cosmeticVariants.push(form);
    } else {
      distinctForms.push(form);
    }
  }

  return { distinctForms, cosmeticVariants };
}
