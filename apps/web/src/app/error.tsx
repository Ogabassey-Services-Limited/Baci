'use client';

import { useEffect } from 'react';
import { captureClientException } from '@/lib/posthog/client-exceptions';
import {
  systemErrorClassNames,
  systemErrorStyleSheet,
} from './system-error-styles';

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
    <>
      <style>{systemErrorStyleSheet}</style>
      <main className={systemErrorClassNames.page}>
        <section
          aria-labelledby="app-error-title"
          className={systemErrorClassNames.card}
        >
          <div aria-hidden="true" className={systemErrorClassNames.icon}>
            !
          </div>

          <h2 className={systemErrorClassNames.cardTitle} id="app-error-title">
            Something went wrong
          </h2>
          <p className={systemErrorClassNames.copy}>
            We encountered an unexpected error while loading this page. Our team
            has been notified.
          </p>

          <div className={systemErrorClassNames.actions}>
            <button
              className={systemErrorClassNames.button}
              onClick={reset}
              type="button"
            >
              Try again
            </button>
            <button
              className={`${systemErrorClassNames.button} ${systemErrorClassNames.buttonSecondary}`}
              onClick={() => {
                window.location.href = '/';
              }}
              type="button"
            >
              Go home
            </button>
          </div>

          {process.env.NODE_ENV === 'development' && (
            <pre className={systemErrorClassNames.debug}>
              {error.name}: {error.message}
              {'\n'}
              {error.stack}
            </pre>
          )}
        </section>
      </main>
    </>
  );
}
