'use client';

import styles from './system-error.module.css';

// Global Error must include its own html and body tags
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  return (
    <html lang="en">
      <body>
        <main className={styles.page}>
          <section aria-labelledby="global-error-title" className={styles.card}>
            <div aria-hidden="true" className={styles.icon}>
              !
            </div>

            <h2 className={styles.title} id="global-error-title">
              Critical Error
            </h2>
            <p className={styles.copy}>
              A critical system error occurred. Please try refreshing the page.
            </p>

            <div className={styles.actions}>
              <button
                className={styles.button}
                onClick={() => window.location.reload()}
                type="button"
              >
                Refresh application
              </button>
            </div>

            {process.env.NODE_ENV === 'development' && (
              <pre className={styles.debug}>
                {error.name}: {error.message}
              </pre>
            )}
          </section>
        </main>
      </body>
    </html>
  );
}
