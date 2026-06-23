interface StorefrontRouteNotFoundContentProps {
  title?: string;
  message?: string;
  backHref?: string;
  backLabel?: string;
}

export function StorefrontRouteNotFoundContent({
  title = 'Page not found',
  message = 'The page you requested is unavailable or has moved.',
  backHref = '/',
  backLabel = 'Continue shopping',
}: StorefrontRouteNotFoundContentProps) {
  return (
    <main
      className="min-h-[40vh] bg-background px-4 py-16 text-foreground"
      data-nosnippet="true"
      data-storefront-soft-not-found="true"
    >
      <section
        aria-labelledby="storefront-soft-not-found-heading"
        className="mx-auto max-w-xl text-center"
      >
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          404
        </p>
        <h1
          className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl"
          id="storefront-soft-not-found-heading"
        >
          {title}
        </h1>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          {message}
        </p>
        <a
          className="mt-8 inline-flex items-center justify-center rounded-full border border-border px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          href={backHref}
        >
          {backLabel}
        </a>
      </section>
    </main>
  );
}
