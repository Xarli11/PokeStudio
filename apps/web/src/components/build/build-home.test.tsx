import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as NextNavigation from 'next/navigation';

import type { ComparablePokemonForm } from '@pokelab/database';

import { addTeamMember, createEmptyTeamDraft, updateTeamMember } from '@/lib/team-draft';
import { saveTeamDraft } from '@/lib/team-storage';

import type { TeamMemberReferenceData } from '@/app/[locale]/build/actions';

import { BuildHome, type BuildHomeLabels } from './build-home';

const VERSION_GROUPS = [{ slug: 'scarlet-violet', generation: 9, displayOrder: 1 }];

const push = vi.fn();

vi.mock('next/navigation', async (importOriginal) => {
  const actual = await importOriginal<typeof NextNavigation>();
  return { ...actual, useRouter: () => ({ push }) };
});

const fetchTeamMemberReferenceData =
  vi.fn<(formSlugs: string[]) => Promise<TeamMemberReferenceData>>();

vi.mock('@/app/[locale]/build/actions', () => ({
  fetchTeamMemberReferenceData: (formSlugs: string[]) => fetchTeamMemberReferenceData(formSlugs),
}));

const LABELS: BuildHomeLabels = {
  myTeams: 'My Teams',
  newTeam: 'New Team',
  untitledTeam: 'New Team',
  noTeams: 'No teams yet.',
  memberCountTemplate: '{count} of 6',
  openTeamTemplate: 'Open {name}',
  deleteTeamTemplate: 'Delete {name}',
  deleteConfirmTemplate: 'Delete "{name}"?',
  deleteDialogTitle: 'Delete team?',
  confirmDeleteLabel: 'Delete team',
  cancelLabel: 'Cancel',
  teamStatusValid: 'Valid',
  teamStatusIncomplete: 'Incomplete',
  teamStatusInvalidOne: '1 error',
  teamStatusInvalidManyTemplate: '{count} errors',
};

afterEach(cleanup);
beforeEach(() => {
  push.mockClear();
  window.localStorage.clear();
  fetchTeamMemberReferenceData.mockReset();
  fetchTeamMemberReferenceData.mockResolvedValue({ forms: [], learnsets: {} });
});

describe('BuildHome', () => {
  it('shows the empty state before any team exists', async () => {
    render(
      <BuildHome
        locale="en"
        defaultVersionGroupSlug="scarlet-violet"
        versionGroups={VERSION_GROUPS}
        labels={LABELS}
      />,
    );
    expect(await screen.findByText('No teams yet.')).not.toBeNull();
  });

  it('lists a previously saved team with its member count', async () => {
    const draft = createEmptyTeamDraft('scarlet-violet', 'Rain Team');
    saveTeamDraft(draft);
    render(
      <BuildHome
        locale="en"
        defaultVersionGroupSlug="scarlet-violet"
        versionGroups={VERSION_GROUPS}
        labels={LABELS}
      />,
    );
    expect(await screen.findByText('Rain Team')).not.toBeNull();
    expect(screen.getByText('0 of 6')).not.toBeNull();
  });

  it('creates a new team on "New Team" and navigates to its editor', async () => {
    render(
      <BuildHome
        locale="en"
        defaultVersionGroupSlug="scarlet-violet"
        versionGroups={VERSION_GROUPS}
        labels={LABELS}
      />,
    );
    await screen.findByText('No teams yet.');
    fireEvent.click(screen.getByRole('button', { name: 'New Team' }));
    expect(push).toHaveBeenCalledTimes(1);
    const [calledUrl] = push.mock.calls[0]!;
    expect(calledUrl).toMatch(/^\/en\/build\/[\w-]+$/);
  });

  it('disables "New Team" when there is no default version group', async () => {
    render(
      <BuildHome
        locale="en"
        defaultVersionGroupSlug={null}
        versionGroups={VERSION_GROUPS}
        labels={LABELS}
      />,
    );
    await screen.findByText('No teams yet.');
    expect(screen.getByRole('button', { name: 'New Team' }).hasAttribute('disabled')).toBe(true);
  });

  it('shows the custom confirmation dialog instead of a browser-native confirm', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    const draft = createEmptyTeamDraft('scarlet-violet', 'Rain Team');
    saveTeamDraft(draft);
    render(
      <BuildHome
        locale="en"
        defaultVersionGroupSlug="scarlet-violet"
        versionGroups={VERSION_GROUPS}
        labels={LABELS}
      />,
    );
    await screen.findByText('Rain Team');
    fireEvent.click(screen.getByRole('button', { name: 'Delete Rain Team' }));
    expect(await screen.findByRole('dialog')).not.toBeNull();
    expect(screen.getByText('Delete team?')).not.toBeNull();
    expect(screen.getByText('Delete "Rain Team"?')).not.toBeNull();
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('deletes a team after confirmation', async () => {
    const draft = createEmptyTeamDraft('scarlet-violet', 'Rain Team');
    saveTeamDraft(draft);
    render(
      <BuildHome
        locale="en"
        defaultVersionGroupSlug="scarlet-violet"
        versionGroups={VERSION_GROUPS}
        labels={LABELS}
      />,
    );
    await screen.findByText('Rain Team');
    fireEvent.click(screen.getByRole('button', { name: 'Delete Rain Team' }));
    await screen.findByRole('dialog');
    fireEvent.click(screen.getByRole('button', { name: 'Delete team' }));
    expect(screen.queryByText('Rain Team')).toBeNull();
    expect(screen.getByText('No teams yet.')).not.toBeNull();
  });

  it('keeps the team when Cancel is clicked', async () => {
    const draft = createEmptyTeamDraft('scarlet-violet', 'Rain Team');
    saveTeamDraft(draft);
    render(
      <BuildHome
        locale="en"
        defaultVersionGroupSlug="scarlet-violet"
        versionGroups={VERSION_GROUPS}
        labels={LABELS}
      />,
    );
    await screen.findByText('Rain Team');
    fireEvent.click(screen.getByRole('button', { name: 'Delete Rain Team' }));
    await screen.findByRole('dialog');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByText('Rain Team')).not.toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('keeps the team when Escape is pressed', async () => {
    const draft = createEmptyTeamDraft('scarlet-violet', 'Rain Team');
    saveTeamDraft(draft);
    render(
      <BuildHome
        locale="en"
        defaultVersionGroupSlug="scarlet-violet"
        versionGroups={VERSION_GROUPS}
        labels={LABELS}
      />,
    );
    await screen.findByText('Rain Team');
    fireEvent.click(screen.getByRole('button', { name: 'Delete Rain Team' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    expect(screen.getByText('Rain Team')).not.toBeNull();
  });
});

describe('team status badges (manual review v2, §9: persistence never implies legality)', () => {
  it('shows Incomplete for a team under 6 members', async () => {
    const draft = createEmptyTeamDraft('scarlet-violet', 'Rain Team');
    saveTeamDraft(draft);
    render(
      <BuildHome
        locale="en"
        defaultVersionGroupSlug="scarlet-violet"
        versionGroups={VERSION_GROUPS}
        labels={LABELS}
      />,
    );
    await screen.findByText('Rain Team');
    expect(await screen.findByText('Incomplete')).not.toBeNull();
  });

  it('shows an error count when a member has an invalid ability', async () => {
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
    fetchTeamMemberReferenceData.mockResolvedValue({ forms: [GARCHOMP_FORM], learnsets: {} });

    let draft = createEmptyTeamDraft('scarlet-violet', 'Rain Team');
    draft = addTeamMember(draft, 'garchomp');
    draft = updateTeamMember(draft, draft.members[0]!.id, { abilitySlug: 'levitate' }); // not Garchomp's
    saveTeamDraft(draft);

    render(
      <BuildHome
        locale="en"
        defaultVersionGroupSlug="scarlet-violet"
        versionGroups={VERSION_GROUPS}
        labels={LABELS}
      />,
    );
    await screen.findByText('Rain Team');
    expect(await screen.findByText('1 error')).not.toBeNull();
  });
});
