'use client';

import { useEffect } from 'react';
import { captureClientException } from '@/lib/posthog/client-exceptions';
import { systemErrorStyles } from './system-error-styles';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureClientException(error, {
      route_surface: 'app',
      digest: error.digest,
    });
    console.error('Client-side application error:', error);
  }, [error]);

  return (
    <main style={systemErrorStyles.page}>
      <section aria-labelledby="app-error-title" style={systemErrorStyles.card}>
        <div aria-hidden="true" style={systemErrorStyles.icon}>
          !
        </div>

        <h2 style={systemErrorStyles.cardTitle} id="app-error-title">
          Something went wrong
        </h2>
        <p style={systemErrorStyles.copy}>
          We encountered an unexpected error while loading this page. Our team
          has been notified.
        </p>

        <div style={systemErrorStyles.actions}>
          <button
            style={systemErrorStyles.button}
            onClick={reset}
            type="button"
          >
            Try again
          </button>
          <button
            style={{
              ...systemErrorStyles.button,
              ...systemErrorStyles.buttonSecondary,
            }}
            onClick={() => {
              window.location.href = '/';
            }}
            type="button"
          >
            Go home
          </button>
        </div>

        {process.env.NODE_ENV === 'development' && (
          <pre style={systemErrorStyles.debug}>
            {error.name}: {error.message}
            {'\n'}
            {error.stack}
          </pre>
        )}
      </section>
    </main>
  );
}
