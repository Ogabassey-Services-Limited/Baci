'use client';

import { useEffect } from 'react';
import styles from './system-error.module.css';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Client-side application error:', error);
  }, [error]);

  return (
    <main className={styles.page}>
      <section aria-labelledby="app-error-title" className={styles.card}>
        <div aria-hidden="true" className={styles.icon}>
          !
        </div>

        <h2 className={styles.title} id="app-error-title">
          Something went wrong
        </h2>
        <p className={styles.copy}>
          We encountered an unexpected error while loading this page. Our team
          has been notified.
        </p>

        <div className={styles.actions}>
          <button className={styles.button} onClick={reset} type="button">
            Try again
          </button>
          <button
            className={`${styles.button} ${styles.buttonSecondary}`}
            onClick={() => {
              window.location.href = '/';
            }}
            type="button"
          >
            Go home
          </button>
        </div>

        {process.env.NODE_ENV === 'development' && (
          <pre className={styles.debug}>
            {error.name}: {error.message}
            {'\n'}
            {error.stack}
          </pre>
        )}
      </section>
    </main>
  );
}
