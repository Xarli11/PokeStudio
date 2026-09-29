import type { BattleSession } from '@pokestudio/battle-engine';

/**
 * In-memory session store for the first Battle UI (ADR-0019). Nothing here is persisted: a restart
 * drops every battle. Sessions expire after `ttlMs` of inactivity and the store refuses new ones
 * beyond `maxSessions`. The HTTP API does not depend on this being memory (a store with the same
 * three operations can replace it).
 */
export interface StoreOptions {
  ttlMs: number;
  maxSessions: number;
  now?: () => number;
}

interface Entry {
  session: BattleSession;
  expiresAt: number;
}

export class SessionStore {
  private readonly entries = new Map<string, Entry>();
  private readonly now: () => number;

  constructor(private readonly options: StoreOptions) {
    this.now = options.now ?? Date.now;
  }

  /** Drops every expired session. */
  sweep(): number {
    const now = this.now();
    let removed = 0;
    for (const [id, entry] of this.entries) {
      if (entry.expiresAt <= now) {
        this.entries.delete(id);
        removed++;
      }
    }
    return removed;
  }

  get size(): number {
    this.sweep();
    return this.entries.size;
  }

  /** Stores a session, or returns `false` when the store is at capacity. */
  add(session: BattleSession): boolean {
    this.sweep();
    if (this.entries.size >= this.options.maxSessions) return false;
    this.entries.set(session.info.battleId, {
      session,
      expiresAt: this.now() + this.options.ttlMs,
    });
    return true;
  }

  /** Returns a live session and renews its lifetime. */
  get(id: string): BattleSession | undefined {
    const entry = this.entries.get(id);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(id);
      return undefined;
    }
    entry.expiresAt = this.now() + this.options.ttlMs;
    return entry.session;
  }

  delete(id: string): boolean {
    return this.entries.delete(id);
  }
}
