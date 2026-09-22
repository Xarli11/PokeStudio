import type { MoveSummary } from '@pokestudio/database';

import type { DamageAdvancedConfig } from '@/lib/damage-advanced';
import type { TeamMemberDraft } from '@/lib/team-draft';

/**
 * Build → Damage Lab, one-way, one-time import (Fase M3.2). Pure and
 * web-layer only — never imported by `@pokestudio/damage` (same boundary
 * `damage-advanced.ts` already draws): a `TeamMemberDraft` is Build's own
 * domain shape, not a damage-domain concept.
 */

/**
 * Maps a team member's configured set to Damage Lab's own Advanced config.
 * Every stat spread is copied into a fresh object — a caller mutating the
 * returned config (Damage Lab's whole reason for existing) must never
 * reach back into the `TeamMemberDraft` still sitting in `localStorage`.
 *
 * `teraEnabled` is always `false` regardless of whether the member has a
 * `teraType` set (task §10): `TeamMemberDraft.teraType` records "this set's
 * configured Tera Type," not "Terastallized in this specific calculation."
 * The imported type is preserved so enabling Terastallize later has it
 * ready, but the calculation itself starts non-Tera until the user
 * explicitly opts in — never silently applied on their behalf.
 */
export function advancedConfigFromTeamMember(member: TeamMemberDraft): DamageAdvancedConfig {
  return {
    level: member.level,
    abilitySlug: member.abilitySlug,
    itemSlug: member.itemSlug,
    natureSlug: member.natureSlug,
    evs: { ...member.evs },
    ivs: { ...member.ivs },
    teraEnabled: false,
    teraType: member.teraType,
  };
}

/**
 * The first of the member's configured moves (in set order) that's also a
 * legal damaging move for the attacker's resolved reference data — `null`
 * if none match (task §12/§13). `attackerMoves` is expected to be
 * `fetchAttackerReferenceData`'s own already-status-filtered list, so a
 * status move in the set is skipped for free, never a reason to special-case
 * it here; an illegal-for-this-game move is skipped the same way, since it
 * simply won't be present in `attackerMoves` either.
 */
export function preferredDamageMoveSlug(
  moveSlugs: readonly (string | null)[],
  attackerMoves: readonly MoveSummary[],
): string | null {
  const legalSlugs = new Set(attackerMoves.map((move) => move.slug));
  for (const slug of moveSlugs) {
    if (slug && legalSlugs.has(slug)) return slug;
  }
  return null;
}
