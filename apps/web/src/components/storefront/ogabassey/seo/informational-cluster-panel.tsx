import type { InformationalClusterModel } from '@/lib/storefront-content/content-cluster-types';

interface InformationalClusterPanelProps {
  model: InformationalClusterModel | null;
}

export function InformationalClusterPanel({
  model,
}: InformationalClusterPanelProps) {
  if (!model) {
    return null;
  }

  return (
    <section
      aria-labelledby="informational-cluster-panel"
      className="mt-8 rounded-3xl border border-[color:color-mix(in_srgb,var(--store-background-text,#111827)_10%,transparent)] bg-[var(--store-background,#ffffff)] p-5 md:p-6"
    >
      <h2
        id="informational-cluster-panel"
        className="text-xl font-semibold text-[var(--store-background-text,#111827)]"
      >
        {model.heading}
      </h2>
      {model.primaryCategoryLink ? (
        <p className="mt-3">
          <a
            className="text-sm font-medium text-[var(--store-primary,#dc2626)] underline-offset-4 hover:underline"
            href={model.primaryCategoryLink.href}
          >
            {model.primaryCategoryLink.label}
          </a>
        </p>
      ) : null}

      {model.commerceLinks.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {model.commerceLinks.map((link) => (
            <li key={link.href}>
              <a
                className="text-sm font-medium text-[var(--store-primary,#dc2626)] underline-offset-4 hover:underline"
                href={link.href}
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      ) : null}

      {model.featuredProducts.length > 0 ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {model.featuredProducts.map((product) => (
            <article
              key={product.href}
              className="rounded-2xl border border-[color:color-mix(in_srgb,var(--store-background-text,#111827)_10%,transparent)] p-4"
            >
              <a
                className="text-base font-semibold text-[var(--store-background-text,#111827)] underline-offset-4 hover:underline"
                href={product.href}
              >
                {product.title}
              </a>
              <p className="mt-2 text-sm text-[var(--store-background-text,#111827)]/70">
                {product.description}
              </p>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
