# ADR-0007: Python as early research/simulation lane

- Status: Accepted
- Date: 2026-09-08

## Context

Battle AI, simulation analysis and future ML benefit from Python's research/data ecosystem, while a second production runtime is unnecessary at project start.

## Decision

Allow Python from early phases under a research/tooling boundary.

Do not deploy a Python API/service until a proven feature needs runtime Python.

## Consequences

- rapid experimentation,
- no premature microservice overhead,
- successful experiments can be ported or productionized deliberately.
