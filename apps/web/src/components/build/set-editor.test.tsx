import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { ComparablePokemonForm } from '@pokelab/database';

import { resolveBuildGameCapabilities } from '@/lib/build-game-capabilities';
import { createEmptyTeamMember } from '@/lib/team-draft';

import { SetEditor, type SetEditorLabels } from './set-editor';

afterEach(cleanup);

const GARCHOMP_FORM: ComparablePokemonForm = {
  formSlug: 'garchomp',
  speciesSlug: 'garchomp',
  nationalDexNumber: 445,
  speciesName: { en: 'Garchomp', es: 'Garchomp' },
  formName: { en: 'Garchomp', es: 'Garchomp' },
  isDefaultForm: true,
  types: ['dragon', 'ground'],
  baseStats: {
    hp: 108,
    attack: 130,
    defense: 95,
    specialAttack: 80,
    specialDefense: 85,
    speed: 102,
  },
  abilities: [{ slug: 'rough-skin', nameEn: 'Rough Skin', isHidden: false, slot: 1 }],
};

const LABELS: SetEditorLabels = {
  nicknameLabel: 'Nickname',
  nicknamePlaceholder: '(species name)',
  levelLabel: 'Level',
  abilityLabel: 'Ability',
  noAbilitySelected: 'Choose an ability',
  hiddenAbilityMarker: '(Hidden)',
  abilityInvalidForForm: 'Not valid for this form',
  itemLabel: 'Held item',
  noItemSelected: 'No item',
  teraTypeLabel: 'Tera Type',
  noTeraType: 'None',
  teraTypeHint: "This game's own Tera Type mechanic.",
  natureLabel: 'Nature',
  noNatureSelected: 'Choose a nature',
  natureNeutral: '(neutral)',
  natureModifierTemplate: '+{increased} / −{decreased}',
  evsLabel: 'EVs',
  evsRemainingTemplate: '{count} EVs remaining',
  evsMaxTemplate: '{total} / {max} EVs',
  evsOverLimitTemplate: '{count} EVs over the limit',
  ivsLabel: 'IVs',
  calculatedStatsLabel: 'Calculated stats',
  legacyStatsUnavailableTemplate: 'Stat calculation for {game} is not implemented yet.',
  historicalMechanicsNoteTemplate: "PokeLab hasn't fully validated {game} yet.",
  movesLabel: 'Moves',
  moveLegalityHint: 'Legal moves only.',
  notLearnableTemplate: 'Not learnable in {game}',
  addMoveLabel: 'Add move',
  changeMoveTemplate: 'Change {name}',
  removeMoveTemplate: 'Remove {name}',
  loadingReferenceData: 'Loading…',
  statLabels: {
    hp: 'HP',
    attack: 'Attack',
    defense: 'Defense',
    specialAttack: 'Sp. Atk',
    specialDefense: 'Sp. Def',
    speed: 'Speed',
  },
  statTierLabels: { low: 'Low', average: 'Average', good: 'Good', excellent: 'Excellent' },
  typeLabels: { dragon: 'Dragon', ground: 'Ground' } as never,
  movePicker: {
    searchLabel: "Search this form's moves…",
    noResultsLabel: 'No moves match these filters.',
    typeFilterLabel: 'Type',
    allTypesLabel: 'All types',
    damageClassFilterLabel: 'Category',
    allDamageClassesLabel: 'All categories',
    damageClassLabels: { physical: 'Physical', special: 'Special', status: 'Status' },
    noPowerLabel: '—',
    alreadySelectedLabel: 'Already on this Pokémon',
    cancelLabel: 'Cancel',
  },
};

function renderSetEditor(versionGroupSlug: string, generation: number) {
  const capabilities = resolveBuildGameCapabilities({ slug: versionGroupSlug, generation });
  render(
    <SetEditor
      locale="en"
      member={createEmptyTeamMember('garchomp')}
      form={GARCHOMP_FORM}
      learnset={undefined}
      versionGroupSlug={versionGroupSlug}
      capabilities={capabilities}
      natures={[]}
      items={[]}
      labels={LABELS}
      onChange={() => {}}
    />,
  );
  return capabilities;
}

describe('SetEditor: mechanic-dependent fields (Milestone 2 final pass §20/§30)', () => {
  it('Scarlet/Violet: shows Ability/Item/Nature/Tera and real calculated stats', () => {
    renderSetEditor('scarlet-violet', 9);
    expect(screen.getByText('Ability')).not.toBeNull();
    expect(screen.getByText('Held item')).not.toBeNull();
    expect(screen.getByText('Nature')).not.toBeNull();
    expect(screen.getByText('Tera Type')).not.toBeNull();
    expect(screen.getByText('EVs')).not.toBeNull();
    expect(screen.getByText('IVs')).not.toBeNull();
    expect(screen.getByText('Calculated stats')).not.toBeNull();
    expect(screen.queryByText(/is not implemented yet/)).toBeNull();
    expect(screen.queryByText(/hasn't fully validated/)).toBeNull();
  });

  it('Emerald: modern mechanics apply, but Tera is hidden (Gen III has no Tera)', () => {
    renderSetEditor('emerald', 3);
    expect(screen.getByText('Ability')).not.toBeNull();
    expect(screen.getByText('Held item')).not.toBeNull();
    expect(screen.getByText('Nature')).not.toBeNull();
    expect(screen.queryByText('Tera Type')).toBeNull();
    expect(screen.getByText('EVs')).not.toBeNull();
    expect(screen.getByText('Calculated stats')).not.toBeNull();
  });

  it('Sword/Shield: modern mechanics apply, no Tera (Dynamax era, not Gen 9)', () => {
    renderSetEditor('sword-shield', 8);
    expect(screen.getByText('Ability')).not.toBeNull();
    expect(screen.queryByText('Tera Type')).toBeNull();
    expect(screen.getByText('Calculated stats')).not.toBeNull();
  });

  it('Gen I (Red/Blue): hides Ability/Item/Nature/Tera, and never shows calculated stats', () => {
    renderSetEditor('red-blue', 1);
    expect(screen.queryByText('Ability')).toBeNull();
    expect(screen.queryByText('Held item')).toBeNull();
    expect(screen.queryByText('Nature')).toBeNull();
    expect(screen.queryByText('Tera Type')).toBeNull();
    expect(screen.queryByText('EVs')).toBeNull();
    expect(screen.queryByText('IVs')).toBeNull();
    expect(screen.queryByText('Calculated stats')).toBeNull();
    expect(
      screen.getByText('Stat calculation for Red / Blue is not implemented yet.'),
    ).not.toBeNull();
    expect(screen.getByText("PokeLab hasn't fully validated Red / Blue yet.")).not.toBeNull();
  });

  it('Gen II (Gold/Silver): held items exist, but abilities/natures/modern stats do not', () => {
    renderSetEditor('gold-silver', 2);
    expect(screen.queryByText('Ability')).toBeNull();
    expect(screen.getByText('Held item')).not.toBeNull();
    expect(screen.queryByText('Nature')).toBeNull();
    expect(screen.queryByText('Calculated stats')).toBeNull();
  });

  it("Let's Go: identified as special ruleset — no modern mechanics assumed, no fake stats", () => {
    renderSetEditor('lets-go-pikachu-lets-go-eevee', 7);
    expect(screen.queryByText('Ability')).toBeNull();
    expect(screen.queryByText('Nature')).toBeNull();
    expect(screen.queryByText('Held item')).toBeNull();
    expect(screen.queryByText('Calculated stats')).toBeNull();
    expect(screen.getByText(/is not implemented yet/)).not.toBeNull();
  });

  it('Legends: Arceus: identified as special ruleset — no modern mechanics assumed, no fake stats', () => {
    renderSetEditor('legends-arceus', 8);
    expect(screen.queryByText('Ability')).toBeNull();
    expect(screen.queryByText('Nature')).toBeNull();
    expect(screen.queryByText('Calculated stats')).toBeNull();
  });
});
