interface StorefrontLayoutLoadingFallbackMobileHeroImage {
  alt: string;
  avifSrc: string;
  fallbackSrc: string;
}

interface StorefrontLayoutLoadingFallbackProps {
  mobileHeroImage?: StorefrontLayoutLoadingFallbackMobileHeroImage;
}

export function StorefrontLayoutLoadingFallback({
  mobileHeroImage,
}: StorefrontLayoutLoadingFallbackProps = {}) {
  return (
    <div
      aria-busy="true"
      className="min-h-screen bg-[var(--store-background,#ffffff)] text-[var(--store-background-text,#111827)]"
    >
      <p
        aria-label="Loading storefront shell"
        className="sr-only"
        role="status"
      >
        Loading storefront shell
      </p>

      <header className="border-[var(--store-background-text,#111827)]/12 border-b bg-[var(--store-background,#ffffff)]">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-4 py-4 md:px-6">
          <div className="h-10 w-32 rounded bg-[var(--store-background-text,#111827)]/14" />
          <div className="hidden gap-6 md:flex">
            <div className="h-4 w-16 rounded bg-[var(--store-background-text,#111827)]/14" />
            <div className="h-4 w-16 rounded bg-[var(--store-background-text,#111827)]/14" />
            <div className="h-4 w-16 rounded bg-[var(--store-background-text,#111827)]/14" />
            <div className="h-4 w-16 rounded bg-[var(--store-background-text,#111827)]/14" />
          </div>
          <div className="flex gap-3">
            <div className="h-10 w-10 rounded-full bg-[var(--store-background-text,#111827)]/14" />
            <div className="h-10 w-10 rounded-full bg-[var(--store-background-text,#111827)]/14" />
          </div>
        </div>
      </header>

      <main className="w-full bg-[var(--store-background,#ffffff)]">
        <section className="relative z-10 mx-auto flex max-w-[1400px] flex-col px-4 pt-4 md:px-6 md:pt-6">
          <section
            aria-label="Mobile hero loading placeholder"
            className="relative order-1 mb-4 h-48 overflow-hidden rounded-2xl bg-[color-mix(in_srgb,var(--store-background-text,#111827)_88%,var(--store-background,#ffffff)_12%)] shadow-2xl ring-1 ring-[color-mix(in_srgb,var(--store-background-text,#111827)_15%,transparent)] md:hidden"
          >
            {mobileHeroImage ? (
              <picture className="absolute inset-0 block h-full w-full">
                <source srcSet={mobileHeroImage.avifSrc} type="image/avif" />
                <img
                  alt={mobileHeroImage.alt}
                  className="h-full w-full object-contain object-right"
                  decoding="async"
                  fetchPriority="auto"
                  height={540}
                  loading="lazy"
                  src={mobileHeroImage.fallbackSrc}
                  width={960}
                />
              </picture>
            ) : (
              <>
                <div className="absolute left-6 top-6 h-6 w-32 rounded bg-[color-mix(in_srgb,var(--store-background,#ffffff)_22%,transparent)]" />
                <div className="absolute left-6 top-16 h-4 w-40 rounded bg-[color-mix(in_srgb,var(--store-background,#ffffff)_16%,transparent)]" />
                <div className="absolute bottom-6 left-6 h-10 w-28 rounded-full bg-[color-mix(in_srgb,var(--store-background,#ffffff)_22%,transparent)]" />
                <div className="absolute right-4 top-5 h-36 w-32 rounded-2xl bg-[color-mix(in_srgb,var(--store-background,#ffffff)_12%,transparent)]" />
              </>
            )}
          </section>

          <section
            aria-label="Desktop hero loading placeholder"
            className="order-2 hidden h-auto grid-cols-1 gap-4 md:grid lg:h-[540px] lg:grid-cols-4"
          >
            <div className="h-[400px] rounded-2xl bg-[linear-gradient(135deg,var(--store-background,#ffffff),color-mix(in_srgb,var(--store-background,#ffffff)_72%,var(--store-background-text,#111827)_28%))] ring-1 ring-[color-mix(in_srgb,var(--store-background-text,#111827)_10%,transparent)] lg:col-span-3 lg:h-full" />
            <div className="hidden h-full flex-col gap-4 lg:col-span-1 lg:flex">
              <div className="flex-1 rounded-2xl bg-[color-mix(in_srgb,var(--store-background,#ffffff)_86%,var(--store-background-text,#111827)_14%)] ring-1 ring-[color-mix(in_srgb,var(--store-background-text,#111827)_10%,transparent)]" />
              <div className="flex-1 rounded-2xl bg-[color-mix(in_srgb,var(--store-background,#ffffff)_86%,var(--store-background-text,#111827)_14%)] ring-1 ring-[color-mix(in_srgb,var(--store-background-text,#111827)_10%,transparent)]" />
            </div>
          </section>
        </section>
      </main>
    </div>
  );
}
