-- Phase 1C.2 follow-up: `move.ailment`/`move.category` were modeled as
-- NOT NULL on the (correct, but incomplete) assumption that PokéAPI's move
-- `meta` block is always present. A full-dataset ingestion run found this
-- false for 110 of 937 moves — mostly very recent Generation IX moves and
-- unreleased-game placeholders that genuinely have no `meta` block yet
-- upstream. Rather than inventing a fake "none"/"damage" default for them
-- (CLAUDE.md §14), these two columns become nullable — see
-- docs/adr/0013-moves-learnsets-schema.md and packages/pokemon-data/src/normalize.ts.

alter table public.move alter column ailment drop not null;
alter table public.move alter column category drop not null;
