import pytest

from pokestudio_research.damage_rolls import summarize_damage_rolls


def test_summarize_damage_rolls_basic() -> None:
    summary = summarize_damage_rolls([85, 88, 90, 92, 95], defender_hp=100)
    assert summary.min_roll == 85
    assert summary.max_roll == 95
    assert summary.ko_chance == 0.0


def test_summarize_damage_rolls_ko_chance() -> None:
    summary = summarize_damage_rolls([95, 100, 105], defender_hp=100)
    assert summary.ko_chance == pytest.approx(2 / 3)


def test_summarize_damage_rolls_rejects_empty() -> None:
    with pytest.raises(ValueError):
        summarize_damage_rolls([], defender_hp=100)
