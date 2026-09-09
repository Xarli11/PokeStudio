# PokeStudio Python research lane

Research/tooling only (ADR-0007). Used for:

- simulation experiments,
- Battle AI research/evaluation,
- statistical analysis,
- notebooks.

This is **not** a production service. Do not add a FastAPI app or deploy this as a runtime
dependency of `apps/web` without a documented current requirement and an ADR (CLAUDE.md §9).

## Setup

```bash
cd research/python
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
```

## Checks

```bash
ruff check .
mypy .
pytest
```
