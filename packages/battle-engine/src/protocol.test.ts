import { describe, expect, it } from 'vitest';

import { createBattle, inputLogForTests } from './session';
import { ChannelProcessor } from './showdown/events';
import {
  parseDetails,
  parseHpText,
  parseIdent,
  parseLine,
  splitChannels,
} from './showdown/protocol';
import { CUSTOM_FORMAT, SEED, teamB } from './test/fixtures';
import { newBattle, playToEnd, startTurnOne } from './test/helpers';
import type { BattleEvent, BattlePerspective } from './types';

describe('|split| channel parsing', () => {
  const chunk = [
    '|move|p1a: m0|Earthquake|p2a: m0',
    '|split|p2',
    '|switch|p2a: m0|Dragonite, L50|100/100',
    '|switch|p2a: m0|Dragonite, L50|100/100 hidden-variant',
    '|split|p1',
    '|-damage|p1a: m0|40/357',
    '|-damage|p1a: m0|12/100',
    '|turn|2',
  ].join('\n');

  it('sends secret lines to the owner and omniscient, shared lines to everyone else', () => {
    const channels = splitChannels(chunk);
    expect(channels[-1]).toContain('|-damage|p1a: m0|40/357');
    expect(channels[-1]).toContain('|switch|p2a: m0|Dragonite, L50|100/100');
    expect(channels[1]).toContain('|-damage|p1a: m0|40/357');
    expect(channels[1]).not.toContain('|-damage|p1a: m0|12/100');
    expect(channels[2]).toContain('|-damage|p1a: m0|12/100');
    expect(channels[2]).not.toContain('|-damage|p1a: m0|40/357');
    expect(channels[0]).toContain('|-damage|p1a: m0|12/100');
    expect(channels[0]).not.toContain('|-damage|p1a: m0|40/357');
  });

  it('gives every channel the unsplit lines and skips empty audiences', () => {
    const channels = splitChannels('|turn|3\n|split|p1\n|-heal|p1a: m0|5/357\n\n|upkeep');
    for (const id of [-1, 0, 1, 2] as const) {
      expect(channels[id]).toContain('|turn|3');
      expect(channels[id]).toContain('|upkeep');
    }
    expect(channels[-1]).toContain('|-heal|p1a: m0|5/357');
    expect(channels[0]).not.toContain('|-heal|p1a: m0|5/357');
    expect(channels[0].some((line) => line.startsWith('|-heal'))).toBe(false);
  });
});

describe('protocol helpers', () => {
  it('parses adapter identities only', () => {
    expect(parseIdent('p1a: m0')).toEqual({ side: 'p1', position: 0, teamIndex: 0 });
    expect(parseIdent('p2: m5')).toEqual({ side: 'p2', position: null, teamIndex: 5 });
    expect(parseIdent('p1a: Chompy')).toBeNull(); // user text never reaches the simulator
    expect(parseIdent(undefined)).toBeNull();
  });

  it('parses lines with [tags], details and HP text', () => {
    expect(parseLine('|-damage|p2a: m0|40/100|[from] item: Life Orb|[of] p1a: m0')).toEqual({
      command: '-damage',
      args: ['p2a: m0', '40/100'],
      tags: { from: 'item: Life Orb', of: 'p1a: m0' },
    });
    expect(parseLine('not protocol')).toBeNull();
    expect(parseDetails('Dragonite, L50, F, shiny')).toEqual({
      species: 'Dragonite',
      level: 50,
      gender: 'F',
    });
    expect(parseDetails('Rotom-Wash')).toEqual({ species: 'Rotom-Wash', level: 100, gender: 'N' });
    expect(parseHpText('63/100 par')).toEqual({ current: 63, max: 100 });
    expect(parseHpText('0 fnt')).toEqual({ current: 0 });
  });

  it('turns a |tie line into a tie result', () => {
    const processor = new ChannelProcessor(
      'spectator',
      () => undefined,
      () => ({ kind: 'tie' }),
    );
    processor.feed(['|tie']);
    expect(processor.events).toEqual([
      { type: 'battle-ended', result: { kind: 'tie' }, seq: 1, turn: 0 },
    ]);
  });

  it('drops protocol it does not understand instead of surfacing raw events', () => {
    const processor = new ChannelProcessor(
      'spectator',
      () => undefined,
      () => ({ kind: 'tie' }),
    );
    processor.feed(['|-anim|p1a: m0|Tackle', '|-message|hello', '|somethingnew|x']);
    expect(processor.events).toEqual([]);
  });
});

describe('protocol boundary of the public API', () => {
  const walk = (value: unknown, visit: (text: string) => void): void => {
    if (typeof value === 'string') visit(value);
    else if (Array.isArray(value)) value.forEach((v) => walk(v, visit));
    else if (value && typeof value === 'object')
      Object.values(value).forEach((v) => walk(v, visit));
  };

  it('no public state or event contains raw protocol, engine identities or packed text', () => {
    const session = newBattle();
    playToEnd(session);
    const strings: string[] = [];
    for (const perspective of ['p1', 'p2', 'spectator', 'omniscient'] as BattlePerspective[]) {
      walk(session.getState(perspective), (t) => strings.push(t));
      walk(session.getEvents(perspective), (t) => strings.push(t));
    }
    expect(strings.length).toBeGreaterThan(100);
    for (const text of strings) {
      expect(text).not.toMatch(/\|/); // protocol / packed-team delimiter
      expect(text).not.toMatch(/^p[12][a-c]?: /); // engine ident
      expect(text).not.toMatch(/^m\d+$/); // adapter's internal name token
    }
    const eventTypes = new Set(session.getEvents('omniscient').map((e: BattleEvent) => e.type));
    expect(eventTypes.has('move-used')).toBe(true);
    expect([...eventTypes].every((type) => type !== ('raw' as string))).toBe(true);
  });

  it('display names and nicknames are inert text: they cannot inject protocol', () => {
    const session = createBattle({
      formatId: CUSTOM_FORMAT,
      seed: SEED,
      sides: {
        p1: {
          displayName: 'Ash|win|P2',
          team: {
            members: [
              {
                species: 'Garchomp',
                nickname: '|win|P2',
                ability: 'Rough Skin',
                moves: ['Earthquake'],
                item: 'Life Orb',
              },
            ],
          },
        },
        p2: { displayName: 'Gary', team: teamB },
      },
    });
    startTurnOne(session, [0], [0, 1]);
    expect(session.getState('spectator').status).toBe('awaiting-choices');
    expect(session.getEvents('omniscient').some((e) => e.type === 'battle-ended')).toBe(false);
    // The simulator only ever saw fixed names and adapter tokens.
    const log = inputLogForTests(session).join('\n');
    expect(log).not.toContain('win|P2');
    expect(log).toContain('"name":"P1"');
    expect(log).toContain('"name":"P2"');
    // The user's text is preserved, untouched, on the PokeStudio side.
    const state = session.getState('p1');
    expect(state.sides.p1.displayName).toBe('Ash|win|P2');
    expect(state.sides.p1.team[0]?.nickname).toBe('|win|P2');
  });
});
