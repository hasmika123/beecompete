'use client';

// Root error boundary — catches errors in the root layout that regular error.tsx
// boundaries can't. Reports to Sentry (inert without a DSN) and renders a minimal
// fallback. Real branded error pages land with R1.
import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main style={{ padding: '3rem 1.5rem', fontFamily: 'system-ui, sans-serif' }}>
          <h1>Something went wrong</h1>
          <p>Please try again. If the problem persists, the team has been notified.</p>
        </main>
      </body>
    </html>
  );
}
