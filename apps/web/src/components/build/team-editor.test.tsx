import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  ComparablePokemonForm,
  FormLearnsetAllVersionGroups,
  Nature,
  SpeciesSearchAlias,
  SpeciesSearchItem,
} from '@pokestudio/database';

import type { BuildReferenceData } from '@/lib/build-reference-data';
import { addTeamMember, createEmptyTeamDraft, updateTeamMember } from '@/lib/team-draft';
import { loadTeamDraft, saveTeamDraft } from '@/lib/team-storage';

import type { TeamMemberReferenceData } from '@/app/[locale]/build/actions';

import { SetEditor as RealSetEditor } from './set-editor';
import { TeamEditor, type TeamEditorLabels } from './team-editor';

const fetchTeamMemberReferenceData =
  vi.fn<(formSlugs: string[]) => Promise<TeamMemberReferenceData>>();

vi.mock('@/app/[locale]/build/actions', () => ({
  fetchTeamMemberReferenceData: (formSlugs: string[]) => fetchTeamMemberReferenceData(formSlugs),
}));

/**
 * `TeamEditor` fetches `/api/build-reference-data` itself (Fase 2B.2) —
 * this stubs `window.fetch` rather than mocking a module, since that's the
 * real integration point. Defaults to an immediately-resolved response
 * (same shape/values `searchIndex`/`natures`/`items` had as static props
 * before this fase) so every existing interaction test keeps working
 * unchanged; tests that specifically exercise the loading/error window
 * override this per-test.
 */
const fetchBuildReferenceData = vi.fn<typeof fetch>();

function resolveBuildReferenceData(data: BuildReferenceData): void {
  fetchBuildReferenceData.mockResolvedValue(new Response(JSON.stringify(data), { status: 200 }));
}

function rejectBuildReferenceData(): void {
  fetchBuildReferenceData.mockRejectedValue(new Error('network error'));
}

afterEach(cleanup);
beforeEach(() => {
  window.localStorage.clear();
  fetchTeamMemberReferenceData.mockReset();
  fetchTeamMemberReferenceData.mockResolvedValue({ forms: [], learnsets: {} });
  fetchBuildReferenceData.mockReset();
  resolveBuildReferenceData({ searchIndex: SEARCH_INDEX, natures: [], items: [] });
  vi.stubGlobal('fetch', fetchBuildReferenceData);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const TYPE_LABELS: Record<string, string> = {
  normal: 'Normal',
  fire: 'Fire',
  ground: 'Ground',
  dragon: 'Dragon',
  dark: 'Dark',
};

const LABELS: TeamEditorLabels = {
  backToTeams: 'Back to My Teams',
  teamNameLabel: 'Team name',
  versionGroupLabel: 'Game',
  generationOptionTemplate: 'Generation {number}',
  statusHeader: {
    savingIndicator: 'Saving…',
    saveFailed: "Couldn't save",
    savedValidLabel: 'Saved · Valid',
    draftSavedIncomplete: 'Draft saved · Incomplete',
    draftSavedInvalidOne: 'Draft saved · 1 error',
    draftSavedInvalidManyTemplate: 'Draft saved · {count} errors',
    reviewLabel: 'Review',
    viewAllIssuesTemplate: 'View all {count} issues',
  },
  closeEditorLabel: 'Close',
  closeEditorTemplate: "Close {name}'s configuration",
  testDamageLabel: 'Test damage',
  testDamageTemplate: "Test {name}'s damage in Damage Lab",
  loadingReferenceDataLabel: 'Loading…',
  referenceDataErrorMessage: "Couldn't load Pokémon data.",
  retryReferenceDataLabel: 'Retry',
  teamSlot: {
    addPokemonSlot: 'Add Pokémon',
    removeFromTeamTemplate: 'Remove {name} from team',
    configureLabel: 'Configure',
    configureTemplate: 'Configure {name}',
    changeFormTemplate: "Change {name}'s Pokémon or form",
    changeFormLabel: 'Change form',
    removePokemonLabel: 'Remove Pokémon',
  },
  rosterPicker: {
    addPokemonHeader: 'Add Pokémon',
    addPokemonSlot: 'Add Pokémon',
    changeFormTemplate: "Change {name}'s Pokémon or form",
    cancelChangeForm: 'Cancel',
    multipleFormsMatchTemplate: '{count} forms match',
    ambiguousHint: 'Type more of the name to pick one form.',
    noResultsLabel: 'No Pokémon match your search.',
  },
  setEditor: {
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
    teraTypeHint: 'Gen 9 only',
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
    historicalMechanicsNoteTemplate: "PokeStudio hasn't fully validated {game} yet.",
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
    typeLabels: TYPE_LABELS as never,
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
  },
  analysis: {
    analysisTitle: 'Team analysis',
    unsupportedTemplate: "Team analysis for {game} isn't fully supported yet.",
    unsupportedDetail: 'Historical type mechanics for this game are still being implemented.',
    defensiveTitle: 'Defensive type profile',
    defensiveHint: 'Type-based only.',
    defensiveWeakCountTemplate: '{count} weak',
    defensiveResistCountTemplate: '{count} resist',
    defensiveImmuneCountTemplate: '{count} immune',
    repeatedWeaknessBadge: 'Repeated weakness',
    offensiveTitle: 'Offensive coverage',
    offensiveHint: 'Type-only.',
    offensiveSummaryTemplate: '{covered} / {total} types covered',
    offensiveNoCoverage: 'No super-effective coverage yet.',
    coveredLabel: 'Covered',
    uncoveredLabel: 'Uncovered',
    severityLabels: { incomplete: 'Incomplete', warning: 'Warning', invalid: 'Invalid' },
    memberMovesUnavailableOneTemplate: '{member} has 1 move unavailable in {game}.',
    memberMovesUnavailableManyTemplate: '{member} has {count} moves unavailable in {game}.',
    warningMessages: {
      incompleteTeam: 'This team has fewer than 6 Pokémon.',
      repeatedSevereWeakness: '3 or more team members are weak to {type}.',
      noAbility: 'No ability selected.',
      invalidAbility: '"{detail}" is not valid.',
      noMoves: 'No moves selected.',
      duplicateMove: '"{detail}" is selected more than once.',
      illegalMove: '"{detail}" cannot be learned.',
      evTotalExceeded: 'Total EVs exceed 510.',
      evStatExceeded: 'An EV is out of range.',
      invalidIv: 'An IV is out of range.',
      unsupportedRuleset: "PokeStudio hasn't fully validated {game} yet.",
      speciesUnavailableInGeneration: '{member} is not available in {game}.',
    },
  },
  problems: {
    problemsTitle: 'Problems',
    noProblemsDetected: 'No problems detected.',
    reviewLabel: 'Review',
    severityLabels: { incomplete: 'Incomplete', warning: 'Warning', invalid: 'Invalid' },
  },
};

const SEARCH_INDEX: { items: SpeciesSearchItem[]; aliases: SpeciesSearchAlias[] } = {
  items: [
    {
      slug: 'garchomp',
      formSlug: 'garchomp',
      nationalDexNumber: 445,
      name: { en: 'Garchomp', es: 'Garchomp' },
      types: ['dragon', 'ground'],
      baseStats: {
        hp: 108,
        attack: 130,
        defense: 95,
        specialAttack: 80,
        specialDefense: 85,
        speed: 102,
      },
    },
    {
      slug: 'meowth',
      formSlug: 'meowth',
      nationalDexNumber: 52,
      name: { en: 'Meowth', es: 'Meowth' },
      types: ['normal'],
      baseStats: {
        hp: 40,
        attack: 45,
        defense: 35,
        specialAttack: 40,
        specialDefense: 40,
        speed: 90,
      },
    },
  ],
  aliases: [],
};

// Real Pokédex form: Alolan Meowth is Dark-type, not Normal like the
// species' default form — used by the optimistic-identity tests below to
// prove a non-default form's own types/name are shown, never the species'.
const MEOWTH_ALOLA_ALIAS: SpeciesSearchAlias = {
  name: { en: 'Alolan Meowth', es: 'Meowth de Alola' },
  speciesSlug: 'meowth',
  types: ['dark'],
  formSlug: 'meowth-alola',
};

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
  abilities: [
    { slug: 'sand-veil', nameEn: 'Sand Veil', isHidden: false, slot: 1 },
    { slug: 'rough-skin', nameEn: 'Rough Skin', isHidden: false, slot: 2 },
  ],
};

const GARCHOMP_LEARNSET: FormLearnsetAllVersionGroups = {
  versionGroups: [{ slug: 'scarlet-violet', generation: 9, displayOrder: 1 }],
  moves: [
    {
      slug: 'earthquake',
      nameEn: 'Earthquake',
      type: 'ground',
      damageClass: 'physical',
      power: 100,
      accuracy: 100,
      pp: 10,
      priority: 0,
    },
    {
      slug: 'dragon-claw',
      nameEn: 'Dragon Claw',
      type: 'dragon',
      damageClass: 'physical',
      power: 80,
      accuracy: 100,
      pp: 15,
      priority: 0,
    },
  ],
  entries: [
    {
      moveSlug: 'earthquake',
      versionGroupSlug: 'scarlet-violet',
      learnMethod: 'level-up',
      level: 1,
    },
    {
      moveSlug: 'dragon-claw',
      versionGroupSlug: 'scarlet-violet',
      learnMethod: 'level-up',
      level: 1,
    },
  ],
};

function renderEditor(
  teamId: string,
  locale: 'en' | 'es' = 'en',
  versionGroups = [{ slug: 'scarlet-violet', generation: 9, displayOrder: 1 }],
) {
  return render(
    <TeamEditor
      locale={locale}
      teamId={teamId}
      versionGroups={versionGroups}
      releaseSha="test-sha"
      typeLabels={TYPE_LABELS as never}
      labels={LABELS}
    />,
  );
}

describe('TeamEditor', () => {
  it('shows a way back to My Teams for an id that was never saved', async () => {
    renderEditor('does-not-exist');
    expect(await screen.findByText(/Back to My Teams/)).not.toBeNull();
  });

  it('loads a saved draft and renders its name and empty slots', async () => {
    const draft = createEmptyTeamDraft('scarlet-violet', 'Sand Team');
    saveTeamDraft(draft);
    renderEditor(draft.id);
    expect(await screen.findByDisplayValue('Sand Team')).not.toBeNull();
    // 6 empty slots, no filled ones yet.
    expect(screen.getAllByRole('button', { name: 'Add Pokémon' })).toHaveLength(6);
  });

  it('shows a real, readable game name for the version group, grouped by generation — never the raw slug', async () => {
    const draft = createEmptyTeamDraft('scarlet-violet', 'Sand Team');
    saveTeamDraft(draft);
    renderEditor(draft.id);
    expect(await screen.findByRole('option', { name: 'Scarlet / Violet' })).not.toBeNull();
    expect(screen.getByRole('group', { name: 'Generation 9' })).not.toBeNull();
    expect(screen.queryByText('scarlet-violet')).toBeNull();
  });

  it('renders a filled slot once reference data resolves, and opens the set editor on select', async () => {
    fetchTeamMemberReferenceData.mockResolvedValue({
      forms: [GARCHOMP_FORM],
      learnsets: {},
    });
    let draft = createEmptyTeamDraft('scarlet-violet', 'Sand Team');
    draft = addTeamMember(draft, 'garchomp');
    saveTeamDraft(draft);

    renderEditor(draft.id);
    expect(await screen.findByRole('button', { name: 'Configure Garchomp' })).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Configure Garchomp' }));
    expect(await screen.findByText('Nickname')).not.toBeNull();
    expect(screen.getByText('Ability')).not.toBeNull();
    // Both real abilities are offered, constrained to this form's own.
    expect(screen.getByRole('option', { name: 'Sand Veil' })).not.toBeNull();
    expect(screen.getByRole('option', { name: 'Rough Skin' })).not.toBeNull();
  });

  it('removing the only member reverts to 6 empty slots and persists the removal', async () => {
    fetchTeamMemberReferenceData.mockResolvedValue({ forms: [GARCHOMP_FORM], learnsets: {} });
    let draft = createEmptyTeamDraft('scarlet-violet', 'Sand Team');
    draft = addTeamMember(draft, 'garchomp');
    saveTeamDraft(draft);

    renderEditor(draft.id);
    const removeButton = await screen.findByRole('button', {
      name: 'Remove Garchomp from team',
    });
    fireEvent.click(removeButton);

    expect(await screen.findAllByRole('button', { name: 'Add Pokémon' })).toHaveLength(6);
    await waitFor(() => expect(loadTeamDraft(draft.id)?.members).toHaveLength(0));
  });

  it('shows the team analysis panel with the "no issues" state for an empty team', async () => {
    const draft = createEmptyTeamDraft('scarlet-violet', 'Sand Team');
    saveTeamDraft(draft);
    renderEditor(draft.id);
    expect(await screen.findByText('Team analysis')).not.toBeNull();
    // An empty team is still "incomplete" (fewer than 6), so the warnings
    // list is non-empty even though nothing else is wrong.
    expect(await screen.findByText('This team has fewer than 6 Pokémon.')).not.toBeNull();
  });

  it('lets a filled slot change form via the same search combobox, preserving the configured set', async () => {
    const MEOWTH_FORM: ComparablePokemonForm = {
      formSlug: 'meowth',
      speciesSlug: 'meowth',
      nationalDexNumber: 52,
      speciesName: { en: 'Meowth', es: 'Meowth' },
      formName: { en: 'Meowth', es: 'Meowth' },
      isDefaultForm: true,
      types: ['normal'],
      baseStats: {
        hp: 40,
        attack: 45,
        defense: 35,
        specialAttack: 40,
        specialDefense: 40,
        speed: 90,
      },
      abilities: [{ slug: 'pickup', nameEn: 'Pickup', isHidden: false, slot: 1 }],
    };
    fetchTeamMemberReferenceData.mockImplementation(async (slugs: string[]) => ({
      forms: slugs.includes('meowth') ? [MEOWTH_FORM] : [GARCHOMP_FORM],
      learnsets: {},
    }));

    let draft = createEmptyTeamDraft('scarlet-violet', 'Sand Team');
    draft = addTeamMember(draft, 'garchomp');
    const memberId = draft.members[0]!.id;
    draft = updateTeamMember(draft, memberId, {
      nickname: 'Landy',
      level: 77,
      evs: { hp: 4, attack: 252, defense: 0, specialAttack: 0, specialDefense: 0, speed: 252 },
    });
    saveTeamDraft(draft);

    renderEditor(draft.id);
    await screen.findByRole('button', { name: 'Configure Landy' });

    fireEvent.click(screen.getByRole('button', { name: "Change Landy's Pokémon or form" }));
    // Empty slots are plain trigger buttons now (no embedded search), so
    // there is exactly one shared roster-level picker/combobox at a time.
    const swapInput = await screen.findByRole('combobox', { name: 'Add Pokémon' });
    fireEvent.change(swapInput, { target: { value: 'meowth' } });
    fireEvent.click(screen.getByRole('option', { name: /Meowth/ }));

    // The slot now shows the new form, and the previously-configured
    // nickname/level/EVs survived the swap (only ability/moves reset —
    // proven separately by the existing `changeTeamMemberForm` unit tests).
    const updated = await waitFor(() => {
      const stored = loadTeamDraft(draft.id);
      const member = stored?.members[0];
      if (!member || member.formSlug !== 'meowth') throw new Error('not yet swapped');
      return member;
    });
    expect(updated.nickname).toBe('Landy');
    expect(updated.level).toBe(77);
    expect(updated.evs).toEqual({
      hp: 4,
      attack: 252,
      defense: 0,
      specialAttack: 0,
      specialDefense: 0,
      speed: 252,
    });
  });

  it('resolves warning copy to real display names, never a raw slug, once reference data has loaded', async () => {
    fetchTeamMemberReferenceData.mockResolvedValue({
      forms: [GARCHOMP_FORM],
      learnsets: { garchomp: GARCHOMP_LEARNSET },
    });
    let draft = createEmptyTeamDraft('scarlet-violet', 'Sand Team');
    draft = addTeamMember(draft, 'garchomp');
    const memberId = draft.members[0]!.id;
    draft = updateTeamMember(draft, memberId, {
      abilitySlug: 'levitate', // not one of Garchomp's real abilities
      moveSlugs: ['earthquake', 'earthquake', null, null], // duplicate
    });
    saveTeamDraft(draft);

    renderEditor(draft.id);

    // "levitate" never appears as raw text — only wrapped in the resolved
    // message, which for an unknown ability slug still falls back to it
    // (there's no display name to resolve to), so assert the *move* case
    // instead, where a real display name is available.
    expect(await screen.findByText('"Earthquake" is selected more than once.')).not.toBeNull();
    expect(screen.queryByText(/earthquake/)).toBeNull(); // no lowercase raw slug anywhere
  });
});

describe('locale switch must not lose Build state (manual review CRITICAL bug)', () => {
  it('flushes a pending edit to storage the instant the component unmounts, even well before the debounce would have fired', async () => {
    const draft = createEmptyTeamDraft('scarlet-violet', 'Original Name');
    saveTeamDraft(draft);
    const { unmount } = renderEditor(draft.id);
    const nameInput = await screen.findByDisplayValue('Original Name');
    fireEvent.change(nameInput, { target: { value: 'Edited Name' } });
    // No `waitFor`/timer advance here — unmounting synchronously, well
    // inside the 600ms autosave debounce window, is exactly the scenario a
    // locale-switch click creates.
    unmount();
    expect(loadTeamDraft(draft.id)?.name).toBe('Edited Name');
  });

  it('EN -> ES: the same team (id, renamed name, members) survives a full unmount/remount with a different locale', async () => {
    let draft = createEmptyTeamDraft('scarlet-violet', 'Original Name');
    draft = addTeamMember(draft, 'garchomp');
    saveTeamDraft(draft);

    const { unmount } = renderEditor(draft.id, 'en');
    const nameInput = await screen.findByDisplayValue('Original Name');
    fireEvent.change(nameInput, { target: { value: 'Renamed In EN' } });
    // Simulates exactly what a locale-switch click does: the whole
    // `/en/build/[teamId]` component tree unmounts and a fresh
    // `/es/build/[teamId]` tree mounts, for the same team id.
    unmount();

    renderEditor(draft.id, 'es');
    expect(await screen.findByDisplayValue('Renamed In EN')).not.toBeNull();
    expect(loadTeamDraft(draft.id)?.members).toHaveLength(1);
    expect(loadTeamDraft(draft.id)?.id).toBe(draft.id);
  });

  it('ES -> EN preserves the same data in the other direction', async () => {
    const draft = createEmptyTeamDraft('scarlet-violet', 'Nombre Original');
    saveTeamDraft(draft);
    const { unmount } = renderEditor(draft.id, 'es');
    const nameInput = await screen.findByDisplayValue('Nombre Original');
    fireEvent.change(nameInput, { target: { value: 'Renamed In ES' } });
    unmount();

    renderEditor(draft.id, 'en');
    expect(await screen.findByDisplayValue('Renamed In ES')).not.toBeNull();
  });

  it('localStorage state is locale-independent — one flat key, not one per locale', () => {
    const draft = createEmptyTeamDraft('scarlet-violet', 'Team');
    saveTeamDraft(draft);
    expect(loadTeamDraft(draft.id)).not.toBeNull();
    const teamKeys = Object.keys(window.localStorage).filter((key) => key.includes('teams'));
    expect(teamKeys).toHaveLength(1);
    // Not suffixed/segmented by locale (e.g. no ":en"/":es" or "-en"/"-es").
    expect(teamKeys[0]).not.toMatch(/[:-](en|es)(\b|$)/);
  });
});

describe('roster picker (manual review: must not be trapped in slot width)', () => {
  it('shows a full, unclipped result row (dex number, name, type badges) and adds the member on selection', async () => {
    fetchTeamMemberReferenceData.mockResolvedValue({ forms: [GARCHOMP_FORM], learnsets: {} });
    const draft = createEmptyTeamDraft('scarlet-violet', 'Sand Team');
    saveTeamDraft(draft);

    renderEditor(draft.id);
    fireEvent.click((await screen.findAllByRole('button', { name: 'Add Pokémon' }))[0]!);
    const input = await screen.findByRole('combobox', { name: 'Add Pokémon' });
    fireEvent.change(input, { target: { value: 'garchomp' } });

    const option = await screen.findByRole('option', { name: /Garchomp/ });
    // The full row content is present and readable, not clipped — real
    // dex number, real name, real type labels all in one accessible option.
    expect(option.textContent).toContain('#445');
    expect(option.textContent).toContain('Garchomp');
    expect(option.textContent).toContain('Dragon');
    expect(option.textContent).toContain('Ground');

    fireEvent.click(option);
    // Picker closes and the member is added to the roster (task §5, final
    // product shape pass — reverses the earlier auto-open behavior): its
    // Set Editor stays closed until the user explicitly clicks Configure.
    expect(screen.queryByRole('combobox', { name: 'Add Pokémon' })).toBeNull();
    expect(await screen.findByRole('button', { name: 'Configure Garchomp' })).not.toBeNull();
    expect(screen.queryByText('Nickname')).toBeNull(); // the Set Editor did NOT auto-open
    await waitFor(() => expect(loadTeamDraft(draft.id)?.members).toHaveLength(1));
  });

  it('closes the picker without adding anything via its own Cancel control', async () => {
    const draft = createEmptyTeamDraft('scarlet-violet', 'Sand Team');
    saveTeamDraft(draft);
    renderEditor(draft.id);
    fireEvent.click((await screen.findAllByRole('button', { name: 'Add Pokémon' }))[0]!);
    await screen.findByRole('combobox', { name: 'Add Pokémon' });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('combobox', { name: 'Add Pokémon' })).toBeNull();
    expect(loadTeamDraft(draft.id)?.members).toHaveLength(0);
  });

  it('Escape closes the picker without adding anything', async () => {
    const draft = createEmptyTeamDraft('scarlet-violet', 'Sand Team');
    saveTeamDraft(draft);
    renderEditor(draft.id);
    fireEvent.click((await screen.findAllByRole('button', { name: 'Add Pokémon' }))[0]!);
    const input = await screen.findByRole('combobox', { name: 'Add Pokémon' });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByRole('combobox', { name: 'Add Pokémon' })).toBeNull();
    expect(loadTeamDraft(draft.id)?.members).toHaveLength(0);
  });

  it('shows every match for a broad query and lets the user pick one of several results', async () => {
    fetchTeamMemberReferenceData.mockResolvedValue({ forms: [GARCHOMP_FORM], learnsets: {} });
    const draft = createEmptyTeamDraft('scarlet-violet', 'Sand Team');
    saveTeamDraft(draft);

    renderEditor(draft.id);
    fireEvent.click((await screen.findAllByRole('button', { name: 'Add Pokémon' }))[0]!);
    const input = await screen.findByRole('combobox', { name: 'Add Pokémon' });
    // Both fixture species contain "m" — a broad enough query to surface
    // more than one result at once (compact sizing must not hide any of
    // them, only bound the panel's height with a scrollbar).
    fireEvent.change(input, { target: { value: 'm' } });

    const options = await screen.findAllByRole('option');
    expect(options.length).toBeGreaterThanOrEqual(2);
    fireEvent.click(screen.getByRole('option', { name: /Meowth/ }));
    await waitFor(() => {
      const member = loadTeamDraft(draft.id)?.members[0];
      if (!member || member.formSlug !== 'meowth') throw new Error('not yet added');
    });
  });

  it('shows a compact "no results" state for a query matching nothing — no listbox reserved', async () => {
    const draft = createEmptyTeamDraft('scarlet-violet', 'Sand Team');
    saveTeamDraft(draft);
    renderEditor(draft.id);
    fireEvent.click((await screen.findAllByRole('button', { name: 'Add Pokémon' }))[0]!);
    const input = await screen.findByRole('combobox', { name: 'Add Pokémon' });
    fireEvent.change(input, { target: { value: 'zzzznotapokemon' } });
    expect(await screen.findByText('No Pokémon match your search.')).not.toBeNull();
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('regression: neither the picker container nor the search field wrapper uses a fixed/min-height or row-only flex-basis class (manual review v3, §1 — the actual height bug)', async () => {
    const draft = createEmptyTeamDraft('scarlet-violet', 'Sand Team');
    saveTeamDraft(draft);
    renderEditor(draft.id);
    fireEvent.click((await screen.findAllByRole('button', { name: 'Add Pokémon' }))[0]!);
    const input = await screen.findByRole('combobox', { name: 'Add Pokémon' });

    const pickerContainer = input.closest('[class*="border-dashed"]');
    expect(pickerContainer).not.toBeNull();
    expect(pickerContainer!.className).not.toMatch(/\bmin-h-|(?:^|\s)h-(?:\d|px|full|screen|\[)/);

    // `CompareAddInput`'s own root — `flex-1 basis-*` is fine in Compare's
    // flex-ROW usage, but inside this flex-COLUMN picker it turns
    // flex-basis into an unwanted minimum *height* (the actual root cause).
    const searchFieldWrapper = input.parentElement?.parentElement;
    expect(searchFieldWrapper?.className).not.toMatch(/flex-1|basis-\d/);
  });
});

describe('Set Editor open/close (manual review: Configure discoverability + collapse)', () => {
  it('Configure opens the editor; the close control collapses it without touching member data; reopening restores the same set', async () => {
    fetchTeamMemberReferenceData.mockResolvedValue({ forms: [GARCHOMP_FORM], learnsets: {} });
    let draft = createEmptyTeamDraft('scarlet-violet', 'Sand Team');
    draft = addTeamMember(draft, 'garchomp');
    const memberId = draft.members[0]!.id;
    draft = updateTeamMember(draft, memberId, { nickname: 'Landy', level: 88 });
    saveTeamDraft(draft);

    renderEditor(draft.id);
    fireEvent.click(await screen.findByRole('button', { name: 'Configure Landy' }));
    expect(await screen.findByText('Configure Landy')).not.toBeNull(); // editor header
    expect(screen.getByDisplayValue('88')).not.toBeNull(); // level field shows the real data

    fireEvent.click(screen.getByRole('button', { name: "Close Landy's configuration" }));
    expect(screen.queryByText('Nickname')).toBeNull(); // editor collapsed
    // Data untouched by closing — still on the roster tile and in storage.
    expect(screen.getByRole('button', { name: 'Configure Landy' })).not.toBeNull();
    expect(loadTeamDraft(draft.id)?.members[0]?.level).toBe(88);

    fireEvent.click(screen.getByRole('button', { name: 'Configure Landy' }));
    expect(await screen.findByDisplayValue('88')).not.toBeNull(); // same set restored
  });

  it('Escape collapses the open editor', async () => {
    fetchTeamMemberReferenceData.mockResolvedValue({ forms: [GARCHOMP_FORM], learnsets: {} });
    let draft = createEmptyTeamDraft('scarlet-violet', 'Sand Team');
    draft = addTeamMember(draft, 'garchomp');
    saveTeamDraft(draft);

    renderEditor(draft.id);
    fireEvent.click(await screen.findByRole('button', { name: 'Configure Garchomp' }));
    const nicknameField = await screen.findByLabelText('Nickname');
    fireEvent.keyDown(nicknameField, { key: 'Escape' });
    expect(screen.queryByText('Nickname')).toBeNull();
  });

  it('switching Configure between two members swaps the editor to show the newly selected one', async () => {
    fetchTeamMemberReferenceData.mockResolvedValue({
      forms: [GARCHOMP_FORM, { ...GARCHOMP_FORM, formSlug: 'meowth' }],
      learnsets: {},
    });
    let draft = createEmptyTeamDraft('scarlet-violet', 'Sand Team');
    draft = addTeamMember(draft, 'garchomp');
    draft = addTeamMember(draft, 'meowth');
    draft = updateTeamMember(draft, draft.members[0]!.id, { nickname: 'First' });
    draft = updateTeamMember(draft, draft.members[1]!.id, { nickname: 'Second' });
    saveTeamDraft(draft);

    renderEditor(draft.id);
    fireEvent.click(await screen.findByRole('button', { name: 'Configure First' }));
    expect(await screen.findByText('Configure First')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Configure Second' }));
    expect(await screen.findByText('Configure Second')).not.toBeNull();
    expect(screen.queryByText('Configure First')).toBeNull();
  });
});

describe('lazy-loaded SetEditor (Fase 2B.3 — code-split out of the initial bundle)', () => {
  it('is not part of the initial render — its fields never mount before Configure is tapped', async () => {
    fetchTeamMemberReferenceData.mockResolvedValue({ forms: [GARCHOMP_FORM], learnsets: {} });
    let draft = createEmptyTeamDraft('scarlet-violet', 'Sand Team');
    draft = addTeamMember(draft, 'garchomp');
    saveTeamDraft(draft);

    renderEditor(draft.id);
    await screen.findByRole('button', { name: 'Configure Garchomp' });
    expect(screen.queryByText('Nickname')).toBeNull();
    expect(screen.queryByText('Ability')).toBeNull();
  });

  it('Configure opens the editor panel immediately, shows accessible loading feedback while the chunk loads, then the real editor', async () => {
    // A fresh module graph — not the file's shared, already-imported
    // `TeamEditor` — and a `./set-editor` mock whose promise this test
    // controls directly, so the pending window is deterministic instead of
    // depending on how fast a real dynamic import happens to settle (React's
    // `act()` drains already-queued microtasks, which made a real import
    // resolve before the very next line could observe the fallback).
    vi.resetModules();
    let resolveSetEditorModule!: () => void;
    const deferredSetEditorModule = new Promise<{ SetEditor: typeof RealSetEditor }>((resolve) => {
      resolveSetEditorModule = () => resolve({ SetEditor: RealSetEditor });
    });
    vi.doMock('./set-editor', () => deferredSetEditorModule);

    const { TeamEditor: FreshTeamEditor } = await import('./team-editor');
    fetchTeamMemberReferenceData.mockResolvedValue({ forms: [GARCHOMP_FORM], learnsets: {} });
    let draft = createEmptyTeamDraft('scarlet-violet', 'Sand Team');
    draft = addTeamMember(draft, 'garchomp');
    saveTeamDraft(draft);

    render(
      <FreshTeamEditor
        locale="en"
        teamId={draft.id}
        versionGroups={[{ slug: 'scarlet-violet', generation: 9, displayOrder: 1 }]}
        releaseSha="test-sha"
        typeLabels={TYPE_LABELS as never}
        labels={LABELS}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Configure Garchomp' }));
    // The panel itself (header, close button) is TeamEditor's own JSX, so
    // it mounts synchronously — only SetEditor's own content is deferred.
    expect(screen.getByText('Configure Garchomp')).not.toBeNull();
    expect(screen.queryByText('Nickname')).toBeNull();
    expect(screen.getByText('Loading…')).not.toBeNull();

    resolveSetEditorModule();
    expect(await screen.findByText('Nickname')).not.toBeNull();
    expect(screen.queryByText('Loading…')).toBeNull();

    vi.doUnmock('./set-editor');
  });

  it('closing and reopening does not get stuck on the loading state once the chunk has already loaded', async () => {
    fetchTeamMemberReferenceData.mockResolvedValue({ forms: [GARCHOMP_FORM], learnsets: {} });
    let draft = createEmptyTeamDraft('scarlet-violet', 'Sand Team');
    draft = addTeamMember(draft, 'garchomp');
    saveTeamDraft(draft);

    renderEditor(draft.id);
    fireEvent.click(await screen.findByRole('button', { name: 'Configure Garchomp' }));
    await screen.findByText('Nickname');
    fireEvent.click(screen.getByRole('button', { name: "Close Garchomp's configuration" }));
    expect(screen.queryByText('Nickname')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Configure Garchomp' }));
    // Synchronous — the chunk is already cached, so no lingering fallback.
    expect(screen.getByText('Nickname')).not.toBeNull();
  });

  it('selected member and its optimistic visual identity are unaffected by the lazy SetEditor boundary', async () => {
    fetchTeamMemberReferenceData.mockReturnValue(new Promise(() => {})); // never resolves
    const draft = createEmptyTeamDraft('scarlet-violet', 'Sand Team');
    saveTeamDraft(draft);

    renderEditor(draft.id);
    fireEvent.click((await screen.findAllByRole('button', { name: 'Add Pokémon' }))[0]!);
    const input = await screen.findByRole('combobox', { name: 'Add Pokémon' });
    fireEvent.change(input, { target: { value: 'garchomp' } });
    fireEvent.click(await screen.findByRole('option', { name: /Garchomp/ }));

    await screen.findByRole('button', { name: 'Configure Garchomp' });
    const tile = screen
      .getByRole('button', { name: 'Configure Garchomp' })
      .closest('.rounded-lg') as HTMLElement;
    expect(within(tile).getByText('Garchomp')).not.toBeNull();
    expect(within(tile).getByText('Dragon')).not.toBeNull();

    // Tapping Configure before the real form has resolved still shows the
    // (now-lazy) editor's own loading state — the optimistic identity was
    // never wired into SetEditor/validation, unaffected by this change.
    fireEvent.click(screen.getByRole('button', { name: 'Configure Garchomp' }));
    expect(await screen.findByText('Loading…')).not.toBeNull();
    expect(screen.queryByText('Ability')).toBeNull();
  });

  it('natures and items still reach the editor from shared reference data once the chunk loads', async () => {
    const CAUTIOUS_NATURE: Nature = { slug: 'cautious', nameEn: 'Cautious', nameEs: 'Cauto' };
    resolveBuildReferenceData({
      searchIndex: SEARCH_INDEX,
      natures: [CAUTIOUS_NATURE],
      items: [],
    });
    fetchTeamMemberReferenceData.mockResolvedValue({ forms: [GARCHOMP_FORM], learnsets: {} });
    let draft = createEmptyTeamDraft('scarlet-violet', 'Sand Team');
    draft = addTeamMember(draft, 'garchomp');
    saveTeamDraft(draft);

    renderEditor(draft.id);
    fireEvent.click(await screen.findByRole('button', { name: 'Configure Garchomp' }));
    expect(await screen.findByRole('option', { name: /Cautious/ })).not.toBeNull();
  });

  it('autosave still persists edits made once the lazy editor has loaded', async () => {
    fetchTeamMemberReferenceData.mockResolvedValue({ forms: [GARCHOMP_FORM], learnsets: {} });
    let draft = createEmptyTeamDraft('scarlet-violet', 'Sand Team');
    draft = addTeamMember(draft, 'garchomp');
    saveTeamDraft(draft);

    renderEditor(draft.id);
    fireEvent.click(await screen.findByRole('button', { name: 'Configure Garchomp' }));
    const levelField = await screen.findByLabelText('Level');
    fireEvent.change(levelField, { target: { value: '55' } });

    await waitFor(() => expect(loadTeamDraft(draft.id)?.members[0]?.level).toBe(55));
  });
});

describe('preserve work, validate honestly (manual review v2, §1/§18/§20)', () => {
  it('keeps a move that is no longer legal for the current game visible, with its real name and an explanation — never silently removed', async () => {
    fetchTeamMemberReferenceData.mockResolvedValue({
      forms: [GARCHOMP_FORM],
      learnsets: { garchomp: GARCHOMP_LEARNSET }, // "earthquake" is only legal in scarlet-violet
    });
    let draft = createEmptyTeamDraft('scarlet-violet', 'Sand Team');
    draft = addTeamMember(draft, 'garchomp');
    const memberId = draft.members[0]!.id;
    draft = updateTeamMember(draft, memberId, { moveSlugs: ['earthquake', null, null, null] });
    // What a future multi-version switch would leave behind (task §7: never
    // destroy user work on a version change) — simulated directly here since
    // Build v1's own UI only ever offers Scarlet/Violet (task §6).
    draft = { ...draft, versionGroupSlug: 'sword-shield' };
    saveTeamDraft(draft);

    renderEditor(draft.id);
    fireEvent.click(await screen.findByRole('button', { name: 'Configure Garchomp' }));
    expect(await screen.findByText('Earthquake')).not.toBeNull(); // real name, not a raw slug
    expect(screen.getByText('Not learnable in Sword / Shield')).not.toBeNull();
    // Still there in storage too — nothing was auto-deleted.
    expect(loadTeamDraft(draft.id)?.members[0]?.moveSlugs).toContain('earthquake');
  });

  it('preserves an ability that becomes invalid after a form swap, flagging it instead of silently retaining it as valid or deleting it', async () => {
    const MEOWTH_FORM: ComparablePokemonForm = {
      formSlug: 'meowth',
      speciesSlug: 'meowth',
      nationalDexNumber: 52,
      speciesName: { en: 'Meowth', es: 'Meowth' },
      formName: { en: 'Meowth', es: 'Meowth' },
      isDefaultForm: true,
      types: ['normal'],
      baseStats: {
        hp: 40,
        attack: 45,
        defense: 35,
        specialAttack: 40,
        specialDefense: 40,
        speed: 90,
      },
      abilities: [{ slug: 'pickup', nameEn: 'Pickup', isHidden: false, slot: 1 }],
    };
    fetchTeamMemberReferenceData.mockImplementation(async (slugs: string[]) => ({
      forms: slugs.includes('meowth') ? [MEOWTH_FORM] : [GARCHOMP_FORM],
      learnsets: {},
    }));

    let draft = createEmptyTeamDraft('scarlet-violet', 'Sand Team');
    draft = addTeamMember(draft, 'garchomp');
    const memberId = draft.members[0]!.id;
    draft = updateTeamMember(draft, memberId, { nickname: 'Landy', abilitySlug: 'rough-skin' });
    saveTeamDraft(draft);

    renderEditor(draft.id);
    await screen.findByRole('button', { name: 'Configure Landy' });
    fireEvent.click(screen.getByRole('button', { name: "Change Landy's Pokémon or form" }));
    const swapInput = await screen.findByRole('combobox', { name: 'Add Pokémon' });
    fireEvent.change(swapInput, { target: { value: 'meowth' } });
    fireEvent.click(screen.getByRole('option', { name: /Meowth/ }));

    await waitFor(() => {
      const member = loadTeamDraft(draft.id)?.members[0];
      if (!member || member.formSlug !== 'meowth') throw new Error('not yet swapped');
    });
    // Preserved, not nulled — even though "rough-skin" isn't one of
    // Meowth's abilities.
    expect(loadTeamDraft(draft.id)?.members[0]?.abilitySlug).toBe('rough-skin');

    fireEvent.click(await screen.findByRole('button', { name: 'Configure Landy' }));
    expect(await screen.findByText('Not valid for this form')).not.toBeNull();
  });
});

describe('top-level status header (manual review v3, §3-§7: must explain what is wrong)', () => {
  it('VALID: shows "Saved · Valid" and no error/issue list', async () => {
    const forms: ComparablePokemonForm[] = Array.from({ length: 6 }, (_, i) => ({
      ...GARCHOMP_FORM,
      formSlug: `mon-${i}`,
    }));
    const learnsets = Object.fromEntries(forms.map((f) => [f.formSlug, GARCHOMP_LEARNSET]));
    fetchTeamMemberReferenceData.mockResolvedValue({ forms, learnsets });
    let draft = createEmptyTeamDraft('scarlet-violet', 'Full Team');
    for (let i = 0; i < 6; i++) draft = addTeamMember(draft, `mon-${i}`);
    for (const member of draft.members) {
      draft = updateTeamMember(draft, member.id, {
        abilitySlug: 'rough-skin',
        moveSlugs: ['earthquake', null, null, null],
      });
    }
    saveTeamDraft(draft);

    renderEditor(draft.id);
    expect(await screen.findByText('Saved · Valid')).not.toBeNull();
    expect(screen.queryByText('Review')).toBeNull();
    expect(screen.queryByText(/error/)).toBeNull();
  });

  it('INCOMPLETE: shows "Draft saved · Incomplete", a real missing-requirement reason, and never calls it an error', async () => {
    fetchTeamMemberReferenceData.mockResolvedValue({ forms: [GARCHOMP_FORM], learnsets: {} });
    let draft = createEmptyTeamDraft('scarlet-violet', 'Sand Team');
    draft = addTeamMember(draft, 'garchomp'); // no ability, no moves — and <6 members
    saveTeamDraft(draft);

    renderEditor(draft.id);
    expect(await screen.findByText('Draft saved · Incomplete')).not.toBeNull();
    // Same underlying row also renders in Team Analysis's own Issues list
    // (task §3: one shared source of truth) — appearing twice is expected.
    expect(screen.getAllByText('No ability selected.').length).toBeGreaterThan(0);
    expect(screen.queryByText(/error/)).toBeNull();
  });

  it('INVALID: shows the error count and the actual first reason, with a Review action that selects the member and opens its Set Editor', async () => {
    fetchTeamMemberReferenceData.mockResolvedValue({ forms: [GARCHOMP_FORM], learnsets: {} });
    let draft = createEmptyTeamDraft('scarlet-violet', 'Sand Team');
    draft = addTeamMember(draft, 'garchomp');
    const memberId = draft.members[0]!.id;
    draft = updateTeamMember(draft, memberId, { abilitySlug: 'levitate' }); // not one of Garchomp's
    saveTeamDraft(draft);

    renderEditor(draft.id);
    const headline = await screen.findByText('Draft saved · 1 error');
    // Same row also renders in Problems — expected (shared source of truth).
    expect(screen.getAllByText('"levitate" is not valid.').length).toBeGreaterThan(0);

    // Scoped to the header itself — Problems renders its own Review action
    // for the same row too (task §16), so query the header's own container.
    const headerReview = within(headline.parentElement!).getByRole('button', { name: 'Review' });
    fireEvent.click(headerReview);
    // Selecting the member from the header opens its Set Editor, same as
    // clicking Configure on the roster tile — no separate mechanism.
    expect(await screen.findByText('Configure Garchomp')).not.toBeNull();
    expect(await screen.findByText('Nickname')).not.toBeNull();
  });

  it('MULTIPLE: caps the header at 2 issues and offers "View all N issues" for the rest, which scrolls the Problems section into view', async () => {
    const forms: ComparablePokemonForm[] = ['a', 'b', 'c'].map((suffix) => ({
      ...GARCHOMP_FORM,
      formSlug: `mon-${suffix}`,
    }));
    fetchTeamMemberReferenceData.mockResolvedValue({ forms, learnsets: {} });
    let draft = createEmptyTeamDraft('scarlet-violet', 'Sand Team');
    for (const suffix of ['a', 'b', 'c']) draft = addTeamMember(draft, `mon-${suffix}`);
    for (const member of draft.members) {
      draft = updateTeamMember(draft, member.id, { abilitySlug: 'levitate' }); // invalid for all three
    }
    saveTeamDraft(draft);

    // jsdom doesn't implement scrollIntoView — stub it so the "View all"
    // click's already-guarded call (`typeof x.scrollIntoView === 'function'`)
    // actually fires, so this test can observe it.
    const scrollIntoViewSpy = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoViewSpy;

    renderEditor(draft.id);
    const headline = await screen.findByText('Draft saved · 3 errors');
    // Scoped to the header — Problems renders its own (uncapped) Review
    // actions for the same rows too, by design (task §16).
    const header = within(headline.parentElement!);
    expect(header.getAllByRole('button', { name: 'Review' })).toHaveLength(2); // capped, not 3
    const viewAll = header.getByRole('button', { name: 'View all 3 issues' });

    fireEvent.click(viewAll);
    expect(scrollIntoViewSpy).toHaveBeenCalled();

    Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
  });
});

describe('game selector (Milestone 2 final pass §1: every generation exposed, grouped)', () => {
  const MULTI_GEN_VERSION_GROUPS = [
    { slug: 'scarlet-violet', generation: 9, displayOrder: 1 },
    { slug: 'sword-shield', generation: 8, displayOrder: 1 },
    { slug: 'emerald', generation: 3, displayOrder: 3 },
    { slug: 'red-blue', generation: 1, displayOrder: 1 },
  ];

  it('offers every historical generation, grouped, with human-readable names and no raw slugs', async () => {
    const draft = createEmptyTeamDraft('scarlet-violet', 'Sand Team');
    saveTeamDraft(draft);
    renderEditor(draft.id, 'en', MULTI_GEN_VERSION_GROUPS);

    expect(await screen.findByRole('option', { name: 'Scarlet / Violet' })).not.toBeNull();
    expect(screen.getByRole('option', { name: 'Sword / Shield' })).not.toBeNull();
    expect(screen.getByRole('option', { name: 'Emerald' })).not.toBeNull();
    expect(screen.getByRole('option', { name: 'Red / Blue' })).not.toBeNull();
    expect(screen.queryByText('scarlet-violet')).toBeNull();
    expect(screen.queryByText('red-blue')).toBeNull();

    // Grouped by generation, not a flat list.
    expect(screen.getByRole('group', { name: 'Generation 9' })).not.toBeNull();
    expect(screen.getByRole('group', { name: 'Generation 1' })).not.toBeNull();
  });
});

describe('roster sprite visual scale (manual review, final correction pass §2)', () => {
  it('renders the sprite filling its whole fixed viewport with object-contain — no fixed sub-box wasting margin', async () => {
    fetchTeamMemberReferenceData.mockResolvedValue({ forms: [GARCHOMP_FORM], learnsets: {} });
    let draft = createEmptyTeamDraft('scarlet-violet', 'Sand Team');
    draft = addTeamMember(draft, 'garchomp');
    saveTeamDraft(draft);

    renderEditor(draft.id);
    await screen.findByRole('button', { name: 'Configure Garchomp' });

    const sprite = document.querySelector('img[alt=""]');
    expect(sprite).not.toBeNull();
    expect(sprite?.getAttribute('src')).toContain('/445.png');
    // Fills its container (the fixed viewport), not a smaller fixed sub-box
    // — object-contain then lets each sprite's own intrinsic size scale to
    // make full use of that one shared frame, whatever species it is.
    expect(sprite?.className).toMatch(/\bh-full\b/);
    expect(sprite?.className).toMatch(/\bw-full\b/);
    expect(sprite?.className).toMatch(/\bobject-contain\b/);
  });
});

describe('optimistic roster identity (fix/team-builder-optimistic-roster-identity)', () => {
  /**
   * Type-badge text (e.g. "Dragon") also appears outside the roster tile —
   * in the team analysis defensive/offensive coverage panel, for the same
   * team composition — so every assertion below is scoped to the tile
   * itself via its "Configure {name}" button's card ancestor.
   */
  function tileFor(configureName: string): HTMLElement {
    return screen
      .getByRole('button', { name: configureName })
      .closest('.rounded-lg') as HTMLElement;
  }

  it('shows the selected default-form Pokémon’s real name, types and sprite request immediately, before member reference data resolves', async () => {
    // Never resolves — proves the tile renders real identity from the
    // search index alone, without waiting on this fetch at all.
    fetchTeamMemberReferenceData.mockReturnValue(new Promise(() => {}));
    const draft = createEmptyTeamDraft('scarlet-violet', 'Sand Team');
    saveTeamDraft(draft);

    renderEditor(draft.id);
    fireEvent.click((await screen.findAllByRole('button', { name: 'Add Pokémon' }))[0]!);
    const input = await screen.findByRole('combobox', { name: 'Add Pokémon' });
    fireEvent.change(input, { target: { value: 'garchomp' } });
    fireEvent.click(await screen.findByRole('option', { name: /Garchomp/ }));

    await screen.findByRole('button', { name: 'Configure Garchomp' });
    const tile = tileFor('Configure Garchomp');
    expect(within(tile).getByText('Garchomp')).not.toBeNull();
    expect(within(tile).getByText('Dragon')).not.toBeNull();
    expect(within(tile).getByText('Ground')).not.toBeNull();
    expect(within(tile).queryByText('garchomp')).toBeNull(); // never the raw formSlug
    expect(tile.querySelector('.animate-pulse')).toBeNull(); // no empty skeleton

    // The sprite frame (and its `<img src>` request) is already present —
    // getPokemonSprite() only needs the optimistic identity's fields.
    const sprite = tile.querySelector('img[alt=""]');
    expect(sprite?.getAttribute('src')).toContain('/445.png');
  });

  it('shows a non-default form’s own name and types, not the species’ default form’s', async () => {
    resolveBuildReferenceData({
      searchIndex: { items: SEARCH_INDEX.items, aliases: [MEOWTH_ALOLA_ALIAS] },
      natures: [],
      items: [],
    });
    fetchTeamMemberReferenceData.mockReturnValue(new Promise(() => {}));
    const draft = createEmptyTeamDraft('scarlet-violet', 'Sand Team');
    saveTeamDraft(draft);

    renderEditor(draft.id);
    fireEvent.click((await screen.findAllByRole('button', { name: 'Add Pokémon' }))[0]!);
    const input = await screen.findByRole('combobox', { name: 'Add Pokémon' });
    fireEvent.change(input, { target: { value: 'alolan meowth' } });
    fireEvent.click(await screen.findByRole('option', { name: /Alolan Meowth/ }));

    await screen.findByRole('button', { name: 'Configure Alolan Meowth' });
    const tile = tileFor('Configure Alolan Meowth');
    expect(within(tile).getByText('Alolan Meowth')).not.toBeNull();
    expect(within(tile).getByText('Dark')).not.toBeNull();
    expect(within(tile).queryByText('Normal')).toBeNull(); // not the species' default-form type
  });

  it('a nickname still takes priority over the optimistic identity', async () => {
    fetchTeamMemberReferenceData.mockReturnValue(new Promise(() => {}));
    let draft = createEmptyTeamDraft('scarlet-violet', 'Sand Team');
    draft = addTeamMember(draft, 'garchomp');
    draft = updateTeamMember(draft, draft.members[0]!.id, { nickname: 'Landy' });
    saveTeamDraft(draft);

    renderEditor(draft.id);
    await screen.findByRole('button', { name: 'Configure Landy' });
    const tile = tileFor('Configure Landy');
    expect(within(tile).getByText('Landy')).not.toBeNull();
    expect(within(tile).queryByText('Garchomp')).toBeNull();
  });

  it('the optimistic identity is naturally replaced once the full form arrives, with no flash back to a skeleton', async () => {
    let resolveFetch!: (data: TeamMemberReferenceData) => void;
    fetchTeamMemberReferenceData.mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );
    const draft = createEmptyTeamDraft('scarlet-violet', 'Sand Team');
    saveTeamDraft(draft);

    renderEditor(draft.id);
    fireEvent.click((await screen.findAllByRole('button', { name: 'Add Pokémon' }))[0]!);
    const input = await screen.findByRole('combobox', { name: 'Add Pokémon' });
    fireEvent.change(input, { target: { value: 'garchomp' } });
    fireEvent.click(await screen.findByRole('option', { name: /Garchomp/ }));

    await screen.findByRole('button', { name: 'Configure Garchomp' });
    const tile = tileFor('Configure Garchomp');
    expect(within(tile).getByText('Dragon')).not.toBeNull(); // optimistic

    resolveFetch!({ forms: [GARCHOMP_FORM], learnsets: {} });

    // The type badge never disappears — no reflow back to a skeleton —
    // and Configure now proves the tile is backed by the REAL form (its
    // abilities only exist once `fetchTeamMemberReferenceData` resolves).
    await waitFor(() => expect(within(tile).getByText('Dragon')).not.toBeNull());
    expect(tile.querySelector('.animate-pulse')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Configure Garchomp' }));
    expect(await screen.findByRole('option', { name: 'Sand Veil' })).not.toBeNull();
  });

  it('never uses the optimistic identity for validation/abilities/learnset — Configure still waits on the real form', async () => {
    fetchTeamMemberReferenceData.mockReturnValue(new Promise(() => {}));
    const draft = createEmptyTeamDraft('scarlet-violet', 'Sand Team');
    saveTeamDraft(draft);

    renderEditor(draft.id);
    fireEvent.click((await screen.findAllByRole('button', { name: 'Add Pokémon' }))[0]!);
    const input = await screen.findByRole('combobox', { name: 'Add Pokémon' });
    fireEvent.change(input, { target: { value: 'garchomp' } });
    fireEvent.click(await screen.findByRole('option', { name: /Garchomp/ }));

    await screen.findByRole('button', { name: 'Configure Garchomp' });
    expect(within(tileFor('Configure Garchomp')).getByText('Dragon')).not.toBeNull(); // tile already optimistic

    fireEvent.click(screen.getByRole('button', { name: 'Configure Garchomp' }));
    expect(await screen.findByText('Loading…')).not.toBeNull();
    expect(screen.queryByText('Ability')).toBeNull();
    expect(screen.queryByRole('option', { name: 'Sand Veil' })).toBeNull();
  });

  it('changing form shows the new form’s identity immediately too, and remove/change-form still work while optimistic', async () => {
    fetchTeamMemberReferenceData.mockReturnValue(new Promise(() => {}));
    const draft = createEmptyTeamDraft('scarlet-violet', 'Sand Team');
    saveTeamDraft(draft);

    renderEditor(draft.id);
    fireEvent.click((await screen.findAllByRole('button', { name: 'Add Pokémon' }))[0]!);
    let input = await screen.findByRole('combobox', { name: 'Add Pokémon' });
    fireEvent.change(input, { target: { value: 'garchomp' } });
    fireEvent.click(await screen.findByRole('option', { name: /Garchomp/ }));
    await screen.findByRole('button', { name: 'Configure Garchomp' });
    expect(within(tileFor('Configure Garchomp')).getByText('Dragon')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: "Change Garchomp's Pokémon or form" }));
    input = await screen.findByRole('combobox', { name: 'Add Pokémon' });
    fireEvent.change(input, { target: { value: 'meowth' } });
    fireEvent.click(await screen.findByRole('option', { name: /Meowth/ }));

    await screen.findByRole('button', { name: 'Configure Meowth' });
    const swappedTile = tileFor('Configure Meowth');
    expect(within(swappedTile).getByText('Normal')).not.toBeNull(); // new optimistic identity
    expect(within(swappedTile).queryByText('Dragon')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Remove Meowth from team' }));
    expect(await screen.findAllByRole('button', { name: 'Add Pokémon' })).toHaveLength(6);
  });
});

describe('Add vs. Configure vs. Review (Milestone 2 final pass §5/§16/§28)', () => {
  it('Add Pokémon never opens the Set Editor; Configure opens it explicitly; Review opens the correct member for a specific issue', async () => {
    fetchTeamMemberReferenceData.mockResolvedValue({ forms: [GARCHOMP_FORM], learnsets: {} });
    const draft = createEmptyTeamDraft('scarlet-violet', 'Sand Team');
    saveTeamDraft(draft);

    renderEditor(draft.id);

    // 1. Add Pokémon → search → select → appears in roster → picker closes → STOP.
    fireEvent.click((await screen.findAllByRole('button', { name: 'Add Pokémon' }))[0]!);
    const input = await screen.findByRole('combobox', { name: 'Add Pokémon' });
    fireEvent.change(input, { target: { value: 'garchomp' } });
    fireEvent.click(await screen.findByRole('option', { name: /Garchomp/ }));
    await screen.findByRole('button', { name: 'Configure Garchomp' });
    expect(screen.queryByText('Nickname')).toBeNull(); // no auto-open

    // 2. Configure → explicit user action → opens the editor.
    fireEvent.click(screen.getByRole('button', { name: 'Configure Garchomp' }));
    expect(await screen.findByText('Nickname')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: "Close Garchomp's configuration" }));
    expect(screen.queryByText('Nickname')).toBeNull();

    // 3. Review, from a specific Problems/header row → opens the same
    // member's editor (every open issue here belongs to this one member).
    const reviewButtons = screen.getAllByRole('button', { name: 'Review' });
    fireEvent.click(reviewButtons[0]!);
    expect(await screen.findByText('Configure Garchomp')).not.toBeNull(); // editor header
    expect(screen.getByText('Nickname')).not.toBeNull();
  });
});

describe('Problems vs. Team Analysis (Milestone 2 final pass §13-§16/§32)', () => {
  it('"View all N issues" scrolls to the Problems section, not Team Analysis', async () => {
    const forms: ComparablePokemonForm[] = ['a', 'b', 'c'].map((suffix) => ({
      ...GARCHOMP_FORM,
      formSlug: `mon-${suffix}`,
    }));
    fetchTeamMemberReferenceData.mockResolvedValue({ forms, learnsets: {} });
    let draft = createEmptyTeamDraft('scarlet-violet', 'Sand Team');
    for (const suffix of ['a', 'b', 'c']) draft = addTeamMember(draft, `mon-${suffix}`);
    for (const member of draft.members) {
      draft = updateTeamMember(draft, member.id, { abilitySlug: 'levitate' });
    }
    saveTeamDraft(draft);

    renderEditor(draft.id);
    expect(await screen.findByText('Draft saved · 3 errors')).not.toBeNull();
    expect(await screen.findByText('Problems')).not.toBeNull();
    expect(await screen.findByText('Team analysis')).not.toBeNull();

    const target = document.getElementById('build-problems');
    expect(target).not.toBeNull();
    expect(target?.textContent).toContain('Problems');
    expect(document.getElementById('team-issues')).toBeNull(); // no longer exists
  });

  it('the Problems section reserves scroll offset for the sticky app header (final correction pass §1)', async () => {
    const draft = createEmptyTeamDraft('scarlet-violet', 'Sand Team');
    saveTeamDraft(draft);
    renderEditor(draft.id);
    await screen.findByText('Problems');
    const target = document.getElementById('build-problems');
    // A CSS scroll-margin utility, not a magic pixel value computed in JS —
    // the exact size may be tuned later, but some positive scroll-mt must
    // exist so the heading/first rows land below the sticky header rather
    // than being clipped by it.
    expect(target?.className).toMatch(/\bscroll-mt-\d+\b/);
  });

  it('Problems renders the same corrective rows as the header, and Review opens the right member', async () => {
    fetchTeamMemberReferenceData.mockResolvedValue({ forms: [GARCHOMP_FORM], learnsets: {} });
    let draft = createEmptyTeamDraft('scarlet-violet', 'Sand Team');
    draft = addTeamMember(draft, 'garchomp');
    const memberId = draft.members[0]!.id;
    draft = updateTeamMember(draft, memberId, { abilitySlug: 'levitate', nickname: 'Landy' });
    saveTeamDraft(draft);

    renderEditor(draft.id);
    await screen.findByText('Problems');
    // The row appears in both the header and Problems (shared source of
    // truth) — assert at least one is present and Review opens Landy.
    const reviewButtons = await screen.findAllByRole('button', { name: 'Review' });
    expect(reviewButtons.length).toBeGreaterThan(0);
    fireEvent.click(reviewButtons[reviewButtons.length - 1]!);
    expect(await screen.findByText('Configure Landy')).not.toBeNull();
  });

  it('an empty team shows "No problems detected." only once every issue is actually resolved — not for the always-true empty-slot warning', async () => {
    const draft = createEmptyTeamDraft('scarlet-violet', 'Sand Team');
    saveTeamDraft(draft);
    renderEditor(draft.id);
    await screen.findByText('Problems');
    // An empty team is genuinely incomplete (fewer than 6 members) — this is
    // a real Problems row, not the empty state.
    expect(screen.queryByText('No problems detected.')).toBeNull();
  });
});

describe('species generation validation (manual review, final correction pass §3)', () => {
  const RED_BLUE_AND_SV_VERSION_GROUPS = [
    { slug: 'red-blue', generation: 1, displayOrder: 1 },
    { slug: 'scarlet-violet', generation: 9, displayOrder: 1 },
  ];

  it('Garchomp in Red/Blue is flagged INVALID in Problems and the header, never silently removed', async () => {
    fetchTeamMemberReferenceData.mockResolvedValue({ forms: [GARCHOMP_FORM], learnsets: {} });
    let draft = createEmptyTeamDraft('red-blue', 'Time Team');
    draft = addTeamMember(draft, 'garchomp');
    saveTeamDraft(draft);

    renderEditor(draft.id, 'en', RED_BLUE_AND_SV_VERSION_GROUPS);
    // Appears in both the header and Problems (shared source of truth) —
    // assert at least one, same pattern the existing header/Problems tests
    // already use for a row with `severity: 'invalid'`.
    expect(
      (await screen.findAllByText('Garchomp is not available in Red / Blue.')).length,
    ).toBeGreaterThan(0);
    // Still on the roster and in storage — non-destructive (task's own rule).
    expect(screen.getByRole('button', { name: 'Configure Garchomp' })).not.toBeNull();
    expect(loadTeamDraft(draft.id)?.members).toHaveLength(1);

    // Exposes Review for that member.
    const reviewButtons = screen.getAllByRole('button', { name: 'Review' });
    fireEvent.click(reviewButtons[0]!);
    expect(await screen.findByText('Configure Garchomp')).not.toBeNull();
  });

  it('disappears automatically when switching the game back to a compatible generation', async () => {
    fetchTeamMemberReferenceData.mockResolvedValue({ forms: [GARCHOMP_FORM], learnsets: {} });
    let draft = createEmptyTeamDraft('red-blue', 'Time Team');
    draft = addTeamMember(draft, 'garchomp');
    saveTeamDraft(draft);

    renderEditor(draft.id, 'en', RED_BLUE_AND_SV_VERSION_GROUPS);
    await screen.findAllByText('Garchomp is not available in Red / Blue.');

    fireEvent.change(screen.getByLabelText('Game'), { target: { value: 'scarlet-violet' } });
    await waitFor(() => expect(screen.queryByText(/is not available in/)).toBeNull());
  });
});

describe('historical Team Analysis honesty (manual review, final correction pass §4)', () => {
  it('Red/Blue shows a restrained honest message instead of the modern Defensive/Offensive breakdown', async () => {
    fetchTeamMemberReferenceData.mockResolvedValue({ forms: [GARCHOMP_FORM], learnsets: {} });
    const draft = createEmptyTeamDraft('red-blue', 'Time Team');
    saveTeamDraft(draft);

    renderEditor(draft.id, 'en', [{ slug: 'red-blue', generation: 1, displayOrder: 1 }]);
    expect(await screen.findByText('Team analysis')).not.toBeNull();
    expect(
      await screen.findByText("Team analysis for Red / Blue isn't fully supported yet."),
    ).not.toBeNull();
    expect(
      screen.getByText('Historical type mechanics for this game are still being implemented.'),
    ).not.toBeNull();
    expect(screen.queryByText('Defensive type profile')).toBeNull();
    expect(screen.queryByText('Offensive coverage')).toBeNull();
  });

  it('Scarlet/Violet keeps the modern Defensive/Offensive breakdown unchanged', async () => {
    const draft = createEmptyTeamDraft('scarlet-violet', 'Sand Team');
    saveTeamDraft(draft);
    renderEditor(draft.id);
    expect(await screen.findByText('Defensive type profile')).not.toBeNull();
    expect(screen.getByText('Offensive coverage')).not.toBeNull();
    expect(screen.queryByText(/isn't fully supported yet/)).toBeNull();
  });

  it('an unsupported historical context does not, by itself, make team status invalid', async () => {
    const draft = createEmptyTeamDraft('red-blue', 'Time Team');
    saveTeamDraft(draft);
    renderEditor(draft.id, 'en', [{ slug: 'red-blue', generation: 1, displayOrder: 1 }]);
    await screen.findByText("Team analysis for Red / Blue isn't fully supported yet.");
    // Still just INCOMPLETE (empty roster + unsupported ruleset), never
    // upgraded to an "error" merely because strategic analysis is honestly
    // unavailable — that is a separate axis from legality (task §4).
    expect(await screen.findByText('Draft saved · Incomplete')).not.toBeNull();
    expect(screen.queryByText(/error/)).toBeNull();
  });
});

describe('deferred reference data (Fase 2B.2 — Team Editor critical path)', () => {
  function deferredResponse(): {
    promise: Promise<Response>;
    resolve: (data: BuildReferenceData) => void;
  } {
    let resolve!: (data: BuildReferenceData) => void;
    const promise = new Promise<Response>((res) => {
      resolve = (data) => res(new Response(JSON.stringify(data), { status: 200 }));
    });
    return { promise, resolve };
  }

  it('renders the roster immediately, without waiting for /api/build-reference-data', async () => {
    const { promise } = deferredResponse();
    fetchBuildReferenceData.mockReturnValue(promise);
    const draft = createEmptyTeamDraft('scarlet-violet', 'Sand Team');
    saveTeamDraft(draft);

    renderEditor(draft.id);
    expect(await screen.findByDisplayValue('Sand Team')).not.toBeNull();
    expect(screen.getAllByRole('button', { name: 'Add Pokémon' })).toHaveLength(6);
  });

  it('shows a loading state — not a blank/broken picker — if "Add Pokémon" is tapped before the fetch resolves, then the real picker once it does', async () => {
    const { promise, resolve } = deferredResponse();
    fetchBuildReferenceData.mockReturnValue(promise);
    const draft = createEmptyTeamDraft('scarlet-violet', 'Sand Team');
    saveTeamDraft(draft);

    renderEditor(draft.id);
    fireEvent.click((await screen.findAllByRole('button', { name: 'Add Pokémon' }))[0]!);
    expect(await screen.findByText('Loading…')).not.toBeNull();
    expect(screen.queryByRole('combobox', { name: 'Add Pokémon' })).toBeNull();

    resolve({ searchIndex: SEARCH_INDEX, natures: [], items: [] });
    expect(await screen.findByRole('combobox', { name: 'Add Pokémon' })).not.toBeNull();
  });

  it('a failed fetch shows an error with a retry control, without touching the roster/draft', async () => {
    rejectBuildReferenceData();
    const draft = createEmptyTeamDraft('scarlet-violet', 'Sand Team');
    saveTeamDraft(draft);

    renderEditor(draft.id);
    fireEvent.click((await screen.findAllByRole('button', { name: 'Add Pokémon' }))[0]!);
    expect(await screen.findByText("Couldn't load Pokémon data.")).not.toBeNull();
    // The rest of the editor is unaffected — no 500, no lost draft.
    expect(screen.getByDisplayValue('Sand Team')).not.toBeNull();
    expect(loadTeamDraft(draft.id)?.members).toHaveLength(0);

    resolveBuildReferenceData({ searchIndex: SEARCH_INDEX, natures: [], items: [] });
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('combobox', { name: 'Add Pokémon' })).not.toBeNull();
  });

  it('Configure shows the same loading state if opened before the fetch resolves', async () => {
    fetchTeamMemberReferenceData.mockResolvedValue({ forms: [GARCHOMP_FORM], learnsets: {} });
    const { promise } = deferredResponse();
    fetchBuildReferenceData.mockReturnValue(promise);
    const draft = addTeamMember(createEmptyTeamDraft('scarlet-violet', 'Sand Team'), 'garchomp');
    saveTeamDraft(draft);

    renderEditor(draft.id);
    fireEvent.click(await screen.findByRole('button', { name: 'Configure Garchomp' }));
    expect(await screen.findByText('Loading…')).not.toBeNull();
    expect(screen.queryByText('Nickname')).toBeNull();
  });
});
