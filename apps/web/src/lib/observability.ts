/**
 * PokeLab observability boundary (docs/engineering/OBSERVABILITY.md).
 *
 * No Sentry DSN is configured yet, so this reports to the console for now.
 * Swap the body of `captureException`/`captureMessage` for `@sentry/nextjs`
 * calls once `NEXT_PUBLIC_SENTRY_DSN` is set — call sites do not change.
 * Never pass secrets, tokens or private user/team content through here.
 */
export function captureException(error: unknown, context?: Record<string, unknown>): void {
  console.error('[pokelab:error]', error, context ?? {});
}

export function captureMessage(message: string, context?: Record<string, unknown>): void {
  console.warn('[pokelab:message]', message, context ?? {});
}
