'use client';

import { useEffect } from 'react';
import { captureClientException } from '@/lib/posthog/client-exceptions';
import { systemErrorStyles } from './system-error-styles';

// Global Error must include its own html and body tags
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    captureClientException(error, {
      route_surface: 'global',
      digest: error.digest,
    });
    console.error('Global application error:', error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main style={systemErrorStyles.page}>
          <section
            aria-labelledby="global-error-title"
            style={systemErrorStyles.card}
          >
            <div aria-hidden="true" style={systemErrorStyles.icon}>
              !
            </div>

            <h2 style={systemErrorStyles.cardTitle} id="global-error-title">
              Critical Error
            </h2>
            <p style={systemErrorStyles.copy}>
              A critical system error occurred. Please try refreshing the page.
            </p>

            <div style={systemErrorStyles.actions}>
              <button
                style={systemErrorStyles.button}
                onClick={() => window.location.reload()}
                type="button"
              >
                Refresh application
              </button>
            </div>

            {process.env.NODE_ENV === 'development' && (
              <pre style={systemErrorStyles.debug}>
                {error.name}: {error.message}
              </pre>
            )}
          </section>
        </main>
      </body>
    </html>
  );
}
