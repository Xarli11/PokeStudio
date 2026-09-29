import { formatMessage } from '@pokestudio/i18n';

import type { BattleEvent, BattleSideId } from './types';

/**
 * Deterministic, localized copy for the structured trace. Every sentence is a template filled from
 * event fields — never generated text, never parsed from simulator logs.
 */
export type EventTemplates = Record<string, string>;

export interface EventCopyContext {
  templates: EventTemplates;
  /** Player label for a side ("Ash"). */
  sideName(side: BattleSideId): string;
  /** "Garchomp" or its nickname, with the owning side where useful. */
  pokemonName(ref: { side: BattleSideId; teamIndex: number }): string;
  moveName(id: string): string;
  abilityName(id: string): string;
  itemName(id: string): string;
  conditionName(id: string): string;
}

const t = (ctx: EventCopyContext, key: string, values: Record<string, string | number> = {}) =>
  formatMessage(ctx.templates[key] ?? key, values);

function effectLabel(ctx: EventCopyContext, effect: { kind: string; id: string }): string {
  switch (effect.kind) {
    case 'move':
      return ctx.moveName(effect.id);
    case 'ability':
      return ctx.abilityName(effect.id);
    case 'item':
      return ctx.itemName(effect.id);
    default:
      return ctx.conditionName(effect.id);
  }
}

function hpText(hp: Extract<BattleEvent, { type: 'hp-changed' }>['hp']): string {
  return hp.kind === 'exact' ? `${hp.current}/${hp.max}` : `${hp.percent}%`;
}

/** The main sentence for an event, or `null` for events that only structure the timeline. */
export function describeEvent(event: BattleEvent, ctx: EventCopyContext): string | null {
  const name = (ref: { side: BattleSideId; teamIndex: number }) => ctx.pokemonName(ref);
  const cause = event.cause ? effectLabel(ctx, event.cause) : '';
  const suffix = cause ? ` (${cause})` : '';
  switch (event.type) {
    case 'battle-started':
      return t(ctx, 'battleStarted');
    case 'team-preview':
      return t(ctx, 'teamPreview');
    case 'turn-started':
      return t(ctx, 'turnStarted', { turn: event.turn });
    case 'switched':
      return (
        t(ctx, event.forced ? 'draggedIn' : 'switchedIn', { pokemon: name(event.pokemon) }) + suffix
      );
    case 'position-swapped':
      return t(ctx, 'positionSwapped', { pokemon: name(event.pokemon) });
    case 'move-used':
      return event.target
        ? t(ctx, 'moveUsedOn', {
            pokemon: name(event.user),
            move: ctx.moveName(event.moveId),
            target: name(event.target),
          }) + suffix
        : t(ctx, 'moveUsed', { pokemon: name(event.user), move: ctx.moveName(event.moveId) }) +
            suffix;
    case 'move-missed':
      return t(ctx, 'moveMissed', { pokemon: name(event.user), target: name(event.target) });
    case 'move-failed':
      return event.moveId
        ? t(ctx, 'moveFailedNamed', {
            pokemon: name(event.pokemon),
            move: ctx.moveName(event.moveId),
          })
        : t(ctx, 'moveFailed', { pokemon: name(event.pokemon) });
    case 'move-prevented':
      return t(ctx, 'movePrevented', {
        pokemon: name(event.pokemon),
        reason: ctx.templates[`reason_${event.reason}`] ?? ctx.conditionName(event.reason),
      });
    case 'immune':
      return t(ctx, 'immune', { pokemon: name(event.pokemon) }) + suffix;
    case 'critical-hit':
      return t(ctx, 'criticalHit', { pokemon: name(event.pokemon) });
    case 'effectiveness':
      return t(ctx, event.result === 'super-effective' ? 'superEffective' : 'resisted', {
        pokemon: name(event.pokemon),
      });
    case 'hp-changed':
      return (
        t(
          ctx,
          event.change === 'heal' ? 'hpHealed' : event.change === 'damage' ? 'hpDamaged' : 'hpSet',
          {
            pokemon: name(event.pokemon),
            hp: hpText(event.hp),
          },
        ) + suffix
      );
    case 'fainted':
      return t(ctx, 'fainted', { pokemon: name(event.pokemon) });
    case 'status-changed':
      return event.status
        ? t(ctx, 'statusGained', {
            pokemon: name(event.pokemon),
            status: ctx.templates[`status_${event.status}`] ?? event.status,
          }) + suffix
        : t(ctx, 'statusCured', { pokemon: name(event.pokemon) });
    case 'volatile-started':
      return (
        t(ctx, 'volatileStarted', {
          pokemon: name(event.pokemon),
          effect: ctx.conditionName(event.id),
        }) + suffix
      );
    case 'volatile-ended':
      return t(ctx, 'volatileEnded', {
        pokemon: name(event.pokemon),
        effect: ctx.conditionName(event.id),
      });
    case 'stat-boosted':
      return (
        t(ctx, event.delta > 0 ? 'statRose' : 'statFell', {
          pokemon: name(event.pokemon),
          stat: ctx.templates[`stat_${event.stat}`] ?? event.stat,
          amount: Math.abs(event.delta),
        }) + suffix
      );
    case 'effect-activated':
      return t(ctx, 'effectActivated', {
        pokemon: name(event.pokemon),
        effect: effectLabel(ctx, event.effect),
      });
    case 'item-changed':
      return t(
        ctx,
        event.change === 'gained'
          ? 'itemGained'
          : event.change === 'consumed'
            ? 'itemConsumed'
            : 'itemRemoved',
        { pokemon: name(event.pokemon), item: ctx.itemName(event.item) },
      );
    case 'terastallized':
      return t(ctx, 'terastallized', { pokemon: name(event.pokemon), type: event.teraType });
    case 'forme-changed':
      return t(ctx, 'formeChanged', { pokemon: name(event.pokemon), species: event.species });
    case 'field-changed': {
      const effect = ctx.conditionName(event.id);
      if (event.field === 'side-condition' && event.side) {
        return t(ctx, event.active ? 'sideConditionStarted' : 'sideConditionEnded', {
          effect,
          side: ctx.sideName(event.side),
        });
      }
      return t(ctx, event.active ? 'fieldStarted' : 'fieldEnded', { effect });
    }
    case 'battle-ended':
      return event.result.kind === 'win'
        ? t(ctx, 'battleWon', { side: ctx.sideName(event.result.winner) })
        : t(ctx, 'battleTied');
  }
}
