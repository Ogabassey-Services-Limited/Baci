'use client';

import { ChunkRecoveryNotice } from '@/components/system/chunk-recovery-notice';
import { useBoundaryErrorReport } from '@/hooks/use-boundary-error-report';
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
  const recovering = useBoundaryErrorReport(error, {
    routeSurface: 'app',
    logLabel: 'Client-side application error',
  });

  if (recovering) {
    return <ChunkRecoveryNotice />;
  }

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
