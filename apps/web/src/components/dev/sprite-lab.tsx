'use client';

import { useMemo, useState } from 'react';

import type { ComparablePokemonForm, VersionGroupSummary } from '@pokelab/database';
import type { Locale } from '@pokelab/i18n';
import type { PokemonType } from '@pokelab/pokemon-data';

import { FilledTeamTile, type TeamSlotLabels } from '@/components/build/team-slot';
import { createEmptyTeamMember } from '@/lib/team-draft';
import { type SpriteResolution, type SpriteStrategy, resolveSprite } from '@/lib/pokemon-sprite';
import type {
  GameEraCoverageResult,
  POKESPRITE_AUDIT_SNAPSHOT,
  SHOWDOWN_AUDIT_SNAPSHOT,
} from '@/lib/sprite-coverage-audit';
import { versionGroupDisplayName } from '@/lib/version-group-label';

import { SpriteLabCard } from './sprite-lab-card';

const SIZE_OPTIONS = [72, 88, 104] as const;

const DEV_TEAM_SLOT_LABELS: TeamSlotLabels = {
  addPokemonSlot: 'Add Pokémon',
  removeFromTeamTemplate: 'Remove {name} from team',
  configureLabel: 'Configure',
  configureTemplate: 'Configure {name}',
  changeFormTemplate: "Change {name}'s Pokémon or form",
  changeFormLabel: 'Change form',
  removePokemonLabel: 'Remove Pokémon',
};

function strategyLabel(strategy: SpriteStrategy): string {
  if (strategy === 'box') return 'Box (PokéSprite)';
  if (strategy === 'showdown') return 'Showdown / Smogon (gen5-style)';
  if (strategy === 'game-era') return 'Game-era (PokéAPI, per game)';
  return 'Modern (PokéAPI, current Dex)';
}

/** The 3-state label task §5 asks for, specific to the `'game-era'` strategy — `'box'`/`'modern'` just show their own `sourceKind` directly. */
function gameEraStateLabel(primary: SpriteResolution, fallback: SpriteResolution): string {
  if (primary.sourceKind === 'game-era') return 'GAME-SPECIFIC';
  if (fallback.url) return 'MODERN FALLBACK';
  return 'UNAVAILABLE';
}

export interface SpriteLabAudit {
  modern: { coveredSpeciesCount: number; totalSpeciesCount: number };
  boxDexRange: { withinAuditedRange: number; totalSpeciesCount: number; generationIxCount: number };
  gameEra: GameEraCoverageResult[];
  pokespriteSnapshot: typeof POKESPRITE_AUDIT_SNAPSHOT;
  showdownSnapshot: typeof SHOWDOWN_AUDIT_SNAPSHOT;
}

export interface SpriteLabProps {
  locale: Locale;
  typeLabels: Record<PokemonType, string>;
  forms: ComparablePokemonForm[];
  gameEraVersionGroups: VersionGroupSummary[];
  audit: SpriteLabAudit;
}

/**
 * Dev-only Sprite Lab UI (final visual review). Compares the four
 * candidate sprite strategies (`pokemon-sprite.ts`'s `SpriteStrategy` —
 * 'modern' / 'box' / 'game-era' / 'showdown') inside PokeLab's actual
 * approved roster card (`FilledTeamTile`, reused completely unmodified as
 * the fixed baseline — task §9/§14: this Lab never changes production
 * behavior) alongside a refined-composition experiment (`SpriteLabCard`)
 * and a raw reference row, plus a size picker and a live coverage-audit
 * summary. `'showdown'` (Pokémon Showdown/Smogon) carries a stricter rights
 * caveat than the other three — see its own audit card below and
 * `docs/engineering/DATA_SOURCES.md`.
 */
export function SpriteLab({
  locale,
  typeLabels,
  forms,
  gameEraVersionGroups,
  audit,
}: SpriteLabProps) {
  const [strategy, setStrategy] = useState<SpriteStrategy>('modern');
  const [sizePx, setSizePx] = useState<(typeof SIZE_OPTIONS)[number]>(88);
  const [gameEraSlug, setGameEraSlug] = useState(
    gameEraVersionGroups.find((vg) => vg.slug === 'scarlet-violet')?.slug ??
      gameEraVersionGroups[0]?.slug ??
      '',
  );
  const [brokenKeys, setBrokenKeys] = useState<Set<string>>(new Set());

  function markBroken(key: string): void {
    setBrokenKeys((current) => new Set(current).add(key));
  }

  const rows = useMemo(
    () =>
      forms.map((form) => {
        const base = {
          formSlug: form.formSlug,
          speciesSlug: form.speciesSlug,
          nationalDexNumber: form.nationalDexNumber,
          isDefaultForm: form.isDefaultForm,
          variant: 'normal' as const,
        };
        const primary = resolveSprite({
          ...base,
          strategy,
          ...(strategy === 'game-era' ? { versionGroupSlug: gameEraSlug } : {}),
        });
        // For 'game-era', when the game-specific asset doesn't exist, show
        // what the broadest modern fallback *would* give instead of a blank
        // — task §5: "make it obvious whether a shown asset is GAME-SPECIFIC,
        // MODERN FALLBACK, or UNAVAILABLE", not just hide the gap.
        const fallback =
          strategy === 'game-era' && primary.sourceKind !== 'game-era'
            ? resolveSprite({ ...base, strategy: 'modern' })
            : primary;
        const displayed = primary.url ? primary : fallback;
        const stateLabel =
          strategy === 'game-era'
            ? gameEraStateLabel(primary, fallback)
            : displayed.sourceKind.toUpperCase();
        return { form, displayed, stateLabel };
      }),
    [forms, strategy, gameEraSlug],
  );

  return (
    <div className="mx-auto flex max-w-wide flex-col gap-8 p-6">
      <header className="flex flex-col gap-2">
        <h1 className="m-0 text-2xl tracking-tight">Sprite Lab (dev only)</h1>
        <p className="m-0 max-w-2xl text-sm text-muted">
          Internal visual/source comparison tool — not linked in navigation, not in the sitemap, not
          indexable, and not reachable in a production build. Every sprite source shown here is
          PROVISIONAL / dev-visual-prototyping only, never commercially/licensing-approved (see
          docs/engineering/DATA_SOURCES.md). Pokémon Showdown/Smogon carries an explicit
          non-commercial restriction stated by its own sprite-project creators — stricter than the
          other three sources, not merely equally provisional.
        </p>
      </header>

      <section className="flex flex-wrap items-end gap-6 rounded-lg border border-border-subtle bg-surface p-4">
        <label className="flex flex-col gap-1 text-xs text-muted">
          Strategy
          <select
            value={strategy}
            onChange={(event) => setStrategy(event.target.value as SpriteStrategy)}
            className="rounded-md border border-border-subtle bg-surface px-2 py-2 text-sm text-foreground"
          >
            <option value="modern">{strategyLabel('modern')}</option>
            <option value="box">{strategyLabel('box')}</option>
            <option value="showdown">{strategyLabel('showdown')}</option>
            <option value="game-era">{strategyLabel('game-era')}</option>
          </select>
        </label>

        {strategy === 'game-era' ? (
          <label className="flex flex-col gap-1 text-xs text-muted">
            Game
            <select
              value={gameEraSlug}
              onChange={(event) => setGameEraSlug(event.target.value)}
              className="rounded-md border border-border-subtle bg-surface px-2 py-2 text-sm text-foreground"
            >
              {gameEraVersionGroups.map((vg) => (
                <option key={vg.slug} value={vg.slug}>
                  {versionGroupDisplayName(vg.slug)}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className="flex flex-col gap-1 text-xs text-muted">
          Sprite size (experiment card)
          <select
            value={sizePx}
            onChange={(event) =>
              setSizePx(Number(event.target.value) as (typeof SIZE_OPTIONS)[number])
            }
            className="rounded-md border border-border-subtle bg-surface px-2 py-2 text-sm text-foreground"
          >
            {SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}px
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="m-0 text-lg">Coverage audit</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border border-border-subtle bg-surface p-4 text-sm">
            <p className="m-0 font-semibold text-foreground">Modern (PokéAPI current Dex)</p>
            <p className="m-0 text-muted">
              {audit.modern.coveredSpeciesCount}/{audit.modern.totalSpeciesCount} species (default
              form only) — includes every Generation IX species.
            </p>
          </div>
          <div className="rounded-lg border border-border-subtle bg-surface p-4 text-sm">
            <p className="m-0 font-semibold text-foreground">Box (PokéSprite)</p>
            <p className="m-0 text-muted">
              Audited {audit.pokespriteSnapshot.auditedAt}:{' '}
              {audit.pokespriteSnapshot.defaultFormsCovered}/
              {audit.pokespriteSnapshot.totalSpeciesCount} default forms,{' '}
              {audit.pokespriteSnapshot.allFormsCovered}/{audit.pokespriteSnapshot.totalFormsCount}{' '}
              all forms. <strong>0/{audit.pokespriteSnapshot.generationIxSpeciesCount}</strong>{' '}
              Generation IX species (no coverage at all).{' '}
              {audit.pokespriteSnapshot.missingDefaultFormsCount} default -form naming mismatches
              (e.g. {audit.pokespriteSnapshot.sampleNamingMismatches.join(', ')}).
            </p>
          </div>
          <div className="rounded-lg border border-border-subtle bg-surface p-4 text-sm">
            <p className="m-0 font-semibold text-foreground">Showdown / Smogon (gen5-style)</p>
            <p className="m-0 text-muted">
              Audited {audit.showdownSnapshot.auditedAt}:{' '}
              {audit.showdownSnapshot.defaultFormsCovered}/
              {audit.showdownSnapshot.totalSpeciesCount} default forms.{' '}
              <strong>
                {audit.showdownSnapshot.generationIxSpeciesCovered}/
                {audit.showdownSnapshot.generationIxSpeciesCount}
              </strong>{' '}
              Generation IX species. Sampled: {audit.showdownSnapshot.nonDefaultFormSampleCovered}/
              {audit.showdownSnapshot.nonDefaultFormSampleSize} non-default forms,{' '}
              {audit.showdownSnapshot.animatedSampleCovered}/
              {audit.showdownSnapshot.animatedSampleSize} animated (stratified, not exhaustive).{' '}
              <strong>Stricter rights caveat than the other three</strong> — see
              docs/engineering/DATA_SOURCES.md.
            </p>
          </div>
          <div className="rounded-lg border border-border-subtle bg-surface p-4 text-sm">
            <p className="m-0 font-semibold text-foreground">Game-era (PokéAPI per game)</p>
            <ul className="m-0 list-none p-0 text-muted">
              {audit.gameEra.map((entry) => (
                <li key={entry.versionGroupSlug}>
                  {versionGroupDisplayName(entry.versionGroupSlug)}: {entry.coveredSpeciesCount}/
                  {entry.totalSpeciesCount}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-6">
        <h2 className="m-0 text-lg">Representative Pokémon</h2>
        {rows.map(({ form, displayed, stateLabel }) => {
          const key = `${form.formSlug}-${strategy}-${gameEraSlug}`;
          const broken = brokenKeys.has(key);
          const name = form.isDefaultForm ? form.speciesName[locale] : form.formName[locale];
          const member = createEmptyTeamMember(form.formSlug);

          return (
            <div
              key={form.formSlug}
              className="flex flex-col gap-3 rounded-lg border border-border-subtle p-4"
            >
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="font-semibold text-foreground">{name}</span>
                <span className="text-xs text-muted">({form.formSlug})</span>
                <span className="rounded-full border border-border-subtle px-2 py-0.5 text-[0.625rem] font-bold tracking-wide uppercase">
                  {broken ? 'UNAVAILABLE (load error)' : stateLabel}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                <span>Raw reference:</span>
                {displayed.url && !broken ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={displayed.url}
                    alt=""
                    onError={() => markBroken(key)}
                    className="h-12 w-12 object-contain [image-rendering:pixelated]"
                  />
                ) : (
                  <span>Unavailable</span>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-muted">
                    Current approved card (baseline — always the production &ldquo;modern&rdquo;
                    strategy)
                  </span>
                  <FilledTeamTile
                    locale={locale}
                    member={member}
                    form={form}
                    typeLabels={typeLabels}
                    labels={DEV_TEAM_SLOT_LABELS}
                    selected={false}
                    onSelect={() => {}}
                    onRemove={() => {}}
                    onStartChangeForm={() => {}}
                  />
                </div>
                <div className="flex flex-col gap-1 sm:col-span-2">
                  <span className="text-xs font-semibold text-muted">
                    Experiment card — {strategyLabel(strategy)}, {sizePx}px sprite
                  </span>
                  <SpriteLabCard
                    name={name}
                    types={form.types}
                    typeLabels={typeLabels}
                    spriteUrl={displayed.url}
                    spriteSizePx={sizePx}
                    broken={broken}
                    onSpriteError={() => markBroken(key)}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
