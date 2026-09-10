'use client';

import { useEffect } from 'react';

import { themeInitScript } from '@pokestudio/ui';

import { captureException } from '@/lib/observability';

import './globals.css';

/**
 * The root error boundary (a whole-app crash) replaces `<html>` entirely, so
 * it can't reuse `[locale]/layout.tsx` or read the locale dictionary the
 * normal way — kept intentionally minimal and English-only (Part K), but
 * still on PokeStudio's actual tokens/theme instead of unstyled system UI.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureException(error, { digest: error.digest });
  }, [error]);

  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--ps-space-4)',
            padding: 'var(--ps-space-6)',
            textAlign: 'center',
          }}
        >
          <h1 style={{ margin: 0, fontSize: 'var(--ps-font-size-2xl)' }}>Something went wrong</h1>
          <p style={{ margin: 0, color: 'var(--ps-color-text-muted)', maxWidth: '32rem' }}>
            An unexpected error occurred. You can try again, or head back to the Pokédex.
          </p>
          <div style={{ display: 'flex', gap: 'var(--ps-space-3)' }}>
            <button type="button" onClick={reset} className="ps-btn ps-btn-primary">
              Try again
            </button>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- this boundary
                replaces the root layout, including whatever broke it, so it must not depend
                on Next's client router being intact. */}
            <a href="/" className="ps-btn">
              Back home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
