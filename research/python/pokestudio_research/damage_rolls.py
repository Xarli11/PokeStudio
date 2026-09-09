"""Minimal statistical spike: summarize a damage roll distribution.

Proves the research lane can consume structured battle/damage data and run
statistical analysis independent of the TypeScript runtime (AI_SPEC.md
"Python research lane"). Not a reimplementation of the damage formula itself —
that authority stays in packages/damage (ADR-0004).
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class DamageRollSummary:
    min_roll: int
    max_roll: int
    mean_roll: float
    ko_chance: float


def summarize_damage_rolls(rolls: list[int], defender_hp: int) -> DamageRollSummary:
    """Summarize a list of damage rolls (e.g. the 16 rolls from the damage engine).

    Args:
        rolls: damage values for each roll, must be non-empty.
        defender_hp: the defending Pokémon's current HP.

    Returns:
        Roll range, mean, and the fraction of rolls that KO the defender.
    """
    if not rolls:
        raise ValueError("rolls must not be empty")

    ko_count = sum(1 for roll in rolls if roll >= defender_hp)

    return DamageRollSummary(
        min_roll=min(rolls),
        max_roll=max(rolls),
        mean_roll=sum(rolls) / len(rolls),
        ko_chance=ko_count / len(rolls),
    )
