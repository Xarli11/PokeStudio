'use client';

import { useEffect } from 'react';

import { captureException } from '@/lib/observability';

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
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: '3rem', textAlign: 'center' }}>
        <h1>Something went wrong</h1>
        <button type="button" onClick={reset}>
          Try again
        </button>
      </body>
    </html>
  );
}
