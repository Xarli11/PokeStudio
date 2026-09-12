'use client';

export interface VersionGroupOption {
  slug: string;
  /** Full display label for this `<select>`'s own option, e.g. "Generation 9 — Scarlet / Violet". */
  label: string;
  /** Short game title alone, e.g. "Scarlet / Violet" — used by the "All moves" games summary/popover (`@/lib/moves-explorer`'s `VersionGroupInfo`), never this select. */
  name: string;
  generation: number;
}

/** Sentinel `<option>` value for "All moves" — never a real version-group slug (those are PokéAPI slugs, always hyphenated words). */
const ALL_MOVES_VALUE = '__all__';

export type VersionGroupSelection = { versionGroupSlug: string } | { allMoves: true };

export interface VersionGroupSelectProps {
  label: string;
  options: VersionGroupOption[];
  /** The current selection's version-group slug, or `undefined` when "All moves" is selected. */
  selectedSlug: string | undefined;
  allMovesLabel: string;
  onChange: (selection: VersionGroupSelection) => void;
}

/**
 * A compact `<select>`, not a full game encyclopedia (task §4) — a plain
 * controlled component now (Phase 1C.2b instant switching): the parent owns
 * `selectedSlug`/`allMoves` state and derives rows from the already-fetched
 * full learnset, so choosing an option here only ever calls `onChange` —
 * never `router.push`, never a server request.
 */
export function VersionGroupSelect({
  label,
  options,
  selectedSlug,
  allMovesLabel,
  onChange,
}: VersionGroupSelectProps) {
  if (options.length === 0) return null;

  return (
    <label className="flex items-center gap-2 text-xs text-muted">
      <span className="whitespace-nowrap">{label}</span>
      <select
        value={selectedSlug ?? ALL_MOVES_VALUE}
        onChange={(event) => {
          const next = event.target.value;
          onChange(next === ALL_MOVES_VALUE ? { allMoves: true } : { versionGroupSlug: next });
        }}
        className="rounded-md border border-border-subtle bg-surface px-2 py-1 text-xs text-foreground"
      >
        {options.map((option) => (
          <option key={option.slug} value={option.slug}>
            {option.label}
          </option>
        ))}
        <option value={ALL_MOVES_VALUE}>{allMovesLabel}</option>
      </select>
    </label>
  );
}
