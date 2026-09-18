/**
 * PokeLab battle-domain boundary (docs/architecture/BATTLE_ENGINE.md, ADR-0003).
 *
 * This Phase 0 spike proves the boundary works end-to-end (headless,
 * deterministic, structured trace) around Pokémon Showdown's simulator.
 * The full interactive `BattleEngine` interface described in
 * docs/architecture/BATTLE_ENGINE.md (createBattle/submitChoice/getLegalChoices) is Phase 4
 * scope and will be built on top of this same boundary.
 */

export type PRNGSeed = readonly [number, number, number, number];

export interface HeadlessBattleInput {
  formatId: string;
  seed: PRNGSeed;
  players: {
    /** Packed team string (`Teams.pack`). Required — random-format team generation is not seeded by `seed`. */
    p1: { name: string; team: string };
    p2: { name: string; team: string };
  };
}

export type StructuredBattleEvent =
  | { type: 'turn'; turn: number }
  | { type: 'move'; source: string; move: string; target: string | undefined }
  | { type: 'damage'; target: string; remainingHpDisplay: string }
  | { type: 'faint'; pokemon: string }
  | { type: 'win'; winner: string }
  | { type: 'raw'; line: string };

export interface HeadlessBattleResult {
  winner: string | null;
  turnCount: number;
  /** Structured subset of the protocol log (docs/architecture/BATTLE_ENGINE.md "Structured battle trace"). */
  events: StructuredBattleEvent[];
}
