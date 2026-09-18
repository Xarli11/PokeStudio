# PokeLab — AI Specification

## Principle

PokeLab AI is **contextual intelligence over verified Pokémon systems**, not a generic chatbot with Pokémon branding.

## Source-of-truth hierarchy

- PokeLab data layer → structured facts
- legality/format engine → valid/invalid
- damage engine → damage numbers/ranges
- battle engine → battle mechanics/state
- competitive dataset → empirical meta evidence
- LLM → natural language interpretation, synthesis, explanation, planning/proposals

## Context model

When the user asks an AI question, attach only relevant authorized context, such as:

- current Pokémon page,
- current team and selected format,
- current matchup,
- current replay/battle state,
- selected game/generation,
- user preferences if explicitly stored/allowed.

Do not send private unrelated data to providers.

## Natural-language search

Example:

> “Fast Water Pokémon that can help with speed control.”

Pipeline:

1. parse intent into structured constraints,
2. validate/filter against PokeLab data,
3. optionally rank using deterministic/meta signals,
4. explain results.

The LLM does not directly invent the result set.

## Team improvement

AI may propose:

- Pokémon changes,
- moves,
- items,
- EVs/IVs/natures,
- Tera Type,
- role changes,
- strategic plans.

Every proposal is checked against legality and structured team rules before being presented as valid.

## Diverse team generation

The same request should not always return the same team.

Example:

> “Build a VGC team around Dragonite.”

Use a pipeline that may combine:

- hard format rules,
- legality,
- required anchor Pokémon,
- role coverage,
- synergy,
- meta statistics,
- matchup scoring,
- candidate diversity/stochastic generation,
- deterministic validation,
- optional simulations later.

Expose assumptions and format context.

## Battle AI

Battle AI is separate from LLM assistance.

Difficulty evolution may include:

1. legal random/basic heuristic,
2. damage-aware heuristic,
3. switching/setup/hazards evaluation,
4. positional evaluation,
5. lookahead/tree search,
6. probabilistic opponent modeling,
7. Monte Carlo methods,
8. learned evaluation/policy models if evidence justifies them.

Potential styles:

- aggressive,
- balanced,
- defensive,
- setup-oriented,
- unpredictable.

Target difficulties may be presented as:

- Beginner,
- Trainer,
- Advanced,
- Competitive,
- Elite.

Names are UX-level and can change.

## Python research lane

Python is encouraged for:

- benchmark analysis,
- simulation datasets,
- strategy evaluation,
- model training,
- reinforcement learning experiments,
- notebooks,
- statistical analysis.

Production integration happens only after an experiment demonstrates value.

## AI Coach

Long-term post-battle coaching should identify:

- critical turns,
- alternatives,
- repeated user mistakes,
- matchup-plan failures,
- risk/reward decisions,
- speed/damage assumptions,
- training recommendations.

The coach should cite battle state/calculation evidence internally, then explain in natural language.

## Provider abstraction

Support multiple providers over time:

- OpenAI,
- Anthropic,
- Google,
- local/self-hosted models where practical.

No core product workflow should be impossible to migrate solely because one provider changes price/API.

## Cost controls

Track at minimum when paid AI arrives:

- requests,
- tokens/units,
- estimated provider cost,
- feature,
- latency,
- failures.

Paid features should be priced so real provider cost is sustainably covered.

## BYOK

Potential future advanced feature:

- users may supply their own provider key,
- keys must be stored/handled securely or not persisted depending on implementation,
- BYOK does not automatically grant all PokeLab+ product benefits.

Do not implement before there is demand.
