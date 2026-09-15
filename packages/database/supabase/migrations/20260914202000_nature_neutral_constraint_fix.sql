-- Milestone 2 follow-up: `nature_increased_decreased_differ` (from
-- 20260914200000_natures.sql) used `increased_stat is distinct from
-- decreased_stat`, intending to forbid a nature raising and lowering the
-- same stat. Found broken on the very first real ingestion run: `IS
-- DISTINCT FROM` treats two NULLs as *not* distinct (`null is distinct
-- from null` evaluates to `false`), so the constraint rejected every
-- neutral nature (Hardy, Docile, Bashful, Quirky, Serious — both columns
-- null), not just a genuine same-stat conflict. The sibling
-- `nature_neutral_or_both_stats` constraint already guarantees "both null
-- or both non-null", so this only needs to compare when they're actually
-- set.

alter table public.nature drop constraint nature_increased_decreased_differ;

alter table public.nature add constraint nature_increased_decreased_differ check (
  increased_stat is null or increased_stat != decreased_stat
);
