import Link from 'next/link';
import styles from './system-error.module.css';

export default function NotFound() {
  return (
    <main className={styles.page}>
      <section aria-labelledby="not-found-title" className={styles.shell}>
        <Link className={styles.brand} href="/">
          Baci
        </Link>
        <p aria-hidden="true" className={styles.statusCode}>
          404
        </p>
        <h1 className={styles.title} id="not-found-title">
          Page not found
        </h1>
        <p className={styles.copy}>
          We could not find the page you are looking for. It may have moved, or
          the link may be incorrect.
        </p>
        <div className={styles.actions}>
          <Link className={styles.button} href="/">
            Go home
          </Link>
          <Link
            className={`${styles.button} ${styles.buttonSecondary}`}
            href="/contact"
          >
            Contact support
          </Link>
        </div>
      </section>
    </main>
  );
}
