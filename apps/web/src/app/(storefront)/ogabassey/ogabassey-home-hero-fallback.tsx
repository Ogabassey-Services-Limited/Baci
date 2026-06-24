import { OgabasseyShellMobileHero } from '@/components/storefront/ogabassey/components/ogabassey-shell-mobile-hero';

/**
 * Geometry-only fallback for the product-driven home hero while the dynamic
 * merchant/product queries stream. It intentionally avoids product names/links
 * so it cannot advertise stale catalog data, but it preserves the mobile h-48
 * and desktop lg:h-[540px] hero slots to avoid blank LCP/CLS during cold cache
 * misses.
 */
export function OgabasseyHomeHeroFallback() {
  return (
    <div
      aria-hidden="true"
      className="w-full bg-store-background relative"
      data-ogabassey-home-hero-fallback="true"
    >
      <section className="max-w-[1400px] mx-auto px-4 md:px-6 relative z-10 pt-4 md:pt-6 flex flex-col">
        <div className="md:hidden order-1">
          <OgabasseyShellMobileHero />
        </div>
        <div className="hidden md:grid grid-cols-1 lg:grid-cols-5 gap-4 h-auto lg:h-[540px] order-2">
          <div className="relative lg:col-span-3 h-[400px] lg:h-full overflow-hidden rounded-2xl ring-1 ring-store-border/70 shadow-lg bg-store-secondary grid grid-cols-5">
            <div className="col-span-3 flex flex-col justify-center gap-3 px-10 lg:px-16 py-8">
              <div className="h-3 w-28 rounded-full bg-store-primary/35" />
              <div className="h-12 w-4/5 rounded-2xl bg-store-secondary-text/10" />
              <div className="h-6 w-40 rounded-full bg-store-secondary-text/10" />
              <div className="mt-1 h-1.5 w-16 rounded-full bg-store-primary/50" />
              <div className="mt-3 h-12 w-40 rounded-full bg-store-primary/45" />
            </div>
            <div className="relative col-span-2 flex items-center justify-center p-8">
              <div className="h-56 w-36 rounded-[2rem] bg-store-secondary-text/10 ring-1 ring-store-border/60" />
            </div>
          </div>
          <div className="flex flex-col gap-4 h-full lg:col-span-2">
            {[0, 1].map((key) => (
              <div
                className="relative grid flex-1 grid-cols-5 overflow-hidden rounded-2xl shadow-lg ring-1 ring-store-border/70 bg-store-secondary"
                key={key}
              >
                <div className="col-span-3 flex flex-col justify-center gap-2 px-5 py-4">
                  <div className="h-2.5 w-24 rounded-full bg-store-primary/35" />
                  <div className="h-7 w-11/12 rounded-xl bg-store-secondary-text/10" />
                  <div className="h-4 w-24 rounded-full bg-store-secondary-text/10" />
                  <div className="mt-1 h-3 w-16 rounded-full bg-store-primary/35" />
                </div>
                <div className="relative col-span-2 flex items-center justify-center p-4">
                  <div className="h-28 w-20 rounded-2xl bg-store-secondary-text/10 ring-1 ring-store-border/60" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      <div className="h-24 md:h-28" />
    </div>
  );
}
