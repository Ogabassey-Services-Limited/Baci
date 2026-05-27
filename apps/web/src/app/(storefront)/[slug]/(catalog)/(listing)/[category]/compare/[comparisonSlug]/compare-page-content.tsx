import { notFound } from 'next/navigation';
import { safeJsonLdStringify } from '@/lib/sanitize-json-ld';
import { buildComparePageSchemas } from '@/lib/storefront-compare/compare-schema';
import { loadComparePage } from '@/lib/storefront-compare/load-compare-page';

interface ComparePageContentProps {
  params: Promise<{
    slug: string;
    category: string;
    comparisonSlug: string;
  }>;
}

function getComparisonColumnLabels(
  page: Awaited<ReturnType<typeof loadComparePage>>
): [string, string] {
  if (!page) {
    return ['Left', 'Right'];
  }

  if (page.kind === 'product' && page.leftProduct && page.rightProduct) {
    return [page.leftProduct.name, page.rightProduct.name];
  }

  if (page.kind === 'brand') {
    return [page.leftBrand, page.rightBrand];
  }

  return ['Left', 'Right'];
}

export async function ComparePageContent({ params }: ComparePageContentProps) {
  const resolvedParams = await params;
  const page = await loadComparePage({
    merchantSlug: resolvedParams.slug,
    categorySlug: resolvedParams.category,
    comparisonSlug: resolvedParams.comparisonSlug,
  });

  if (!page?.isIndexable) {
    notFound();
  }

  const schemas = buildComparePageSchemas({
    breadcrumbItems: page.breadcrumbItems,
    faqItems: page.faqItems,
  });
  const [leftColumnLabel, rightColumnLabel] = getComparisonColumnLabels(page);

  return (
    <>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD schema sanitized
        dangerouslySetInnerHTML={{
          __html: safeJsonLdStringify(schemas.breadcrumb),
        }}
      />
      {schemas.faq && (
        <script
          type="application/ld+json"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD schema sanitized
          dangerouslySetInnerHTML={{
            __html: safeJsonLdStringify(schemas.faq),
          }}
        />
      )}
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="space-y-4">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {page.heading}
          </h1>
          <p className="max-w-3xl text-base text-muted-foreground sm:text-lg">
            {page.summaryVerdict}
          </p>
        </header>

        <section className="mt-8">
          <h2 className="text-xl font-semibold">Key Differences</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-muted-foreground sm:text-base">
            {page.keyDifferences.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="mt-10 overflow-x-auto rounded-2xl border bg-background shadow-sm">
          <table
            aria-label="Product comparison table"
            className="min-w-full border-collapse text-left"
          >
            <thead className="bg-muted/40">
              <tr>
                <th className="px-4 py-3 text-sm font-semibold text-foreground">
                  Spec
                </th>
                <th className="px-4 py-3 text-sm font-semibold text-foreground">
                  {leftColumnLabel}
                </th>
                <th className="px-4 py-3 text-sm font-semibold text-foreground">
                  {rightColumnLabel}
                </th>
              </tr>
            </thead>
            <tbody>
              {page.comparisonRows.map((row) => (
                <tr key={row.label} className="border-t align-top">
                  <th
                    scope="row"
                    className="px-4 py-3 text-sm font-medium text-foreground"
                  >
                    {row.label}
                  </th>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {row.leftValue}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {row.rightValue}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {page.faqItems.length > 0 && (
          <section className="mt-10 space-y-4">
            <h2 className="text-2xl font-semibold">Buyer FAQ</h2>
            <div className="space-y-4">
              {page.faqItems.map((item) => (
                <article key={item.question} className="rounded-2xl border p-4">
                  <h3 className="text-base font-medium text-foreground">
                    {item.question}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {item.answer}
                  </p>
                </article>
              ))}
            </div>
          </section>
        )}

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
