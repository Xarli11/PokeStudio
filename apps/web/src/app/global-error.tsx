'use client';

import { useEffect } from 'react';

import { themeInitScript } from '@pokestudio/ui';

import { captureException } from '@/lib/observability';
import { buttonClass } from '@/lib/ui-classes';

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
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
          <h1 className="m-0 text-2xl">Something went wrong</h1>
          <p className="m-0 max-w-lg text-muted">
            An unexpected error occurred. You can try again, or head back to the Pokédex.
          </p>
          <div className="flex gap-3">
            <button type="button" onClick={reset} className={buttonClass('primary')}>
              Try again
            </button>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- this boundary
                replaces the root layout, including whatever broke it, so it must not depend
                on Next's client router being intact. */}
            <a href="/" className={buttonClass('default')}>
              Back home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
