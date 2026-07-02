'use client';

import { ChunkRecoveryNotice } from '@/components/system/chunk-recovery-notice';
import { useBoundaryErrorReport } from '@/hooks/use-boundary-error-report';
import {
  systemErrorClassNames,
  systemErrorStyleSheet,
} from './system-error-styles';

// Global Error must include its own html and body tags
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  const recovering = useBoundaryErrorReport(error, {
    routeSurface: 'global',
    logLabel: 'Global application error',
  });

  if (recovering) {
    return <ChunkRecoveryNotice wrapInDocument />;
  }

  return (
    <html lang="en">
      <body>
        <style>{systemErrorStyleSheet}</style>
        <main className={systemErrorClassNames.page}>
          <section
            aria-labelledby="global-error-title"
            className={systemErrorClassNames.card}
          >
            <div aria-hidden="true" className={systemErrorClassNames.icon}>
              !
            </div>

            <h2
              className={systemErrorClassNames.cardTitle}
              id="global-error-title"
            >
              Critical Error
            </h2>
            <p className={systemErrorClassNames.copy}>
              A critical system error occurred. Please try refreshing the page.
            </p>

            <div className={systemErrorClassNames.actions}>
              <button
                className={systemErrorClassNames.button}
                onClick={() => window.location.reload()}
                type="button"
              >
                Refresh application
              </button>
            </div>

            {process.env.NODE_ENV === 'development' && (
              <pre className={systemErrorClassNames.debug}>
                {error.name}: {error.message}
              </pre>
            )}
          </section>
        </main>
      </body>
    </html>
  );
}
