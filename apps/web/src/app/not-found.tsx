import Link from 'next/link';
import { systemErrorStyles } from './system-error-styles';

export default function NotFound() {
  return (
    <main style={systemErrorStyles.page}>
      <section
        aria-labelledby="not-found-title"
        style={systemErrorStyles.shell}
      >
        <Link style={systemErrorStyles.brand} href="/">
          Baci
        </Link>
        <p aria-hidden="true" style={systemErrorStyles.statusCode}>
          404
        </p>
        <h1 style={systemErrorStyles.title} id="not-found-title">
          Page not found
        </h1>
        <p style={systemErrorStyles.copy}>
          We could not find the page you are looking for. It may have moved, or
          the link may be incorrect.
        </p>
        <div style={systemErrorStyles.actions}>
          <Link style={systemErrorStyles.button} href="/">
            Go home
          </Link>
          <Link
            style={{
              ...systemErrorStyles.button,
              ...systemErrorStyles.buttonSecondary,
            }}
            href="/contact"
          >
            Contact support
          </Link>
        </div>
      </section>
    </main>
  );
}
