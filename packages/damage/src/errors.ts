/**
 * Structured failures for `calculateDamage`'s input (docs/adr/0004-smogon-calc.md).
 * This validates mechanical/identity compatibility with the requested
 * generation only — never tournament/format legality (that's a different,
 * not-yet-built PokeStudio concern). A raw `@smogon/calc` exception (e.g. its
 * `kochance()` throwing on an unrelated internal assumption) must never reach
 * a caller directly — every failure this package can anticipate is one of
 * these codes instead.
 */
export type DamageInputErrorCode =
  | 'unknown-form'
  | 'unsupported-form'
  | 'unknown-move'
  | 'unknown-ability'
  | 'unknown-item'
  | 'unknown-nature'
  | 'natures-not-available-in-generation'
  | 'level-out-of-range'
  | 'ev-out-of-range'
  | 'iv-out-of-range'
  | 'generation-out-of-range';

export class DamageInputError extends Error {
  readonly code: DamageInputErrorCode;
  /** Which combatant this failure came from, when applicable — omitted for move/generation-level errors. */
  readonly side: 'attacker' | 'defender' | undefined;

  constructor(code: DamageInputErrorCode, message: string, side?: 'attacker' | 'defender') {
    super(message);
    this.name = 'DamageInputError';
    this.code = code;
    this.side = side;
  }
}
