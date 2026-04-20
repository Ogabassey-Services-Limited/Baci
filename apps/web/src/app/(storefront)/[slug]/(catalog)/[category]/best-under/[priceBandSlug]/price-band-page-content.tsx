import { notFound } from 'next/navigation';
import { ProductIndexCard } from '@/app/(storefront)/[slug]/(catalog)/products/product-index-card';
import type { NormalizedProduct } from '@/lib/normalize-product';
import { safeJsonLdStringify } from '@/lib/sanitize-json-ld';
import { buildPriceBandPageSchemas } from '@/lib/storefront-compare/compare-schema';
import { loadPriceBandPage } from '@/lib/storefront-compare/load-price-band-page';

interface PriceBandPageContentProps {
  params: Promise<{
    slug: string;
    category: string;
    priceBandSlug: string;
  }>;
}

function toProductIndexCardModel(
  product: NonNullable<
    Awaited<ReturnType<typeof loadPriceBandPage>>
  >['products'][number]
): NormalizedProduct {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    image: product.image,
    imageLarge: product.image,
    images: product.image ? [product.image] : [],
    category: product.category,
    category_slug: product.category_slug,
    brand: product.brand ?? null,
    price: product.price,
    compare_at_price: null,
    condition: product.condition,
    stock: product.stock,
    rating: 0,
    availability: product.availability,
    product_key_specs: product.product_key_specs ?? null,
    has_condition_offers: product.has_condition_offers,
    available_conditions: [],
    variant_model: 'legacy',
  };
}

export async function PriceBandPageContent({
  params,
}: PriceBandPageContentProps) {
  const resolvedParams = await params;
  const page = await loadPriceBandPage({
    merchantSlug: resolvedParams.slug,
    categorySlug: resolvedParams.category,
    priceBandSlug: resolvedParams.priceBandSlug,
  });

  if (!page?.isIndexable) {
    notFound();
  }

  const priceFormatter = new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: page.payoutCurrency,
    maximumFractionDigits: 0,
  });
  const schemas = buildPriceBandPageSchemas({
    breadcrumbItems: page.breadcrumbItems,
    pageName: page.heading,
    pageUrl: page.canonicalUrl,
    currency: page.payoutCurrency,
    products: page.products,
  });

  return (
    <>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD schema sanitized
        dangerouslySetInnerHTML={{
          __html: safeJsonLdStringify(schemas.breadcrumb),
        }}
      />
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD schema sanitized
        dangerouslySetInnerHTML={{
          __html: safeJsonLdStringify(schemas.itemList),
        }}
      />
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="space-y-3">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {page.heading}
          </h1>
          <p className="max-w-3xl text-base text-muted-foreground sm:text-lg">
            {page.intro}
          </p>
        </header>

        <ul className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {page.products.map((product) => (
            <li key={product.id}>
              <ProductIndexCard
                formattedPrice={priceFormatter.format(product.price)}
                pathPrefix={page.pathPrefix}
                product={toProductIndexCardModel(product)}
              />
            </li>
          ))}
        </ul>

        {page.guideLinks.length > 0 && (
          <section className="mt-10 space-y-4">
            <h2 className="text-2xl font-semibold">
              Buyer guides and support articles
            </h2>
            <ul className="space-y-4">
              {page.guideLinks.map((link) => (
                <li
                  key={link.href}
                  className="space-y-1 rounded-2xl border p-4"
                >
                  <a
                    href={link.href}
                    className="text-base font-semibold text-primary underline-offset-4 hover:underline"
                  >
                    {link.title}
                  </a>
                  <p className="text-sm text-muted-foreground">
                    {link.description}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
