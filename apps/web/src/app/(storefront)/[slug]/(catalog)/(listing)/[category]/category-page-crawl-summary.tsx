interface CategoryPageCrawlSummaryProps {
  categoryName: string;
  merchantName: string;
  productNames?: string[];
}

function formatProductExamples(productNames: string[]): string {
  const examples = productNames
    .map((name) => name.trim())
    .filter(Boolean)
    .slice(0, 3);

  if (examples.length === 0) {
    return 'Use the live product grid to compare available models, prices, condition, warranty notes and delivery options before choosing a listing.';
  }

  return `Current listings may include ${examples.join(', ')}. Use the live product grid to compare available models, prices, condition, warranty notes and delivery options before choosing a listing.`;
}

export function CategoryPageCrawlSummary({
  categoryName,
  merchantName,
  productNames = [],
}: CategoryPageCrawlSummaryProps) {
  return (
    <section className="bg-store-background px-4 pb-12 text-store-background-text sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl rounded-2xl border border-store-border bg-store-background-text/5 p-5">
        <h2 className="text-xl font-semibold">
          Buying {categoryName} on {merchantName}
        </h2>
        <div className="mt-3 space-y-3 text-sm leading-6 text-store-background-text/70 sm:text-base sm:leading-7">
          <p>
            This category page is designed to help shoppers shortlist products
            quickly without opening every listing first. Compare the product
            name, brand, price, stock status, condition and key specifications,
            then open the product page for detailed images, variants and
            checkout options.
          </p>
          <p>{formatProductExamples(productNames)}</p>
        </div>
      </div>
    </section>
  );
}
