'use client';

// Root error boundary — catches errors in the root layout that regular error.tsx
// boundaries can't. Reports to Sentry (inert without a DSN) and renders a minimal
// fallback. Real branded error pages land with R1.
import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main style={{ padding: '3rem 1.5rem', fontFamily: 'system-ui, sans-serif' }}>
          <h1>Something went wrong</h1>
          <p>Please try again. If the problem persists, the team has been notified.</p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: '1rem',
              padding: '0.5rem 1.25rem',
              borderRadius: '9999px',
              border: '1px solid currentColor',
              background: 'transparent',
              font: 'inherit',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
