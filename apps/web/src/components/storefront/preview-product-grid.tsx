'use client';

type PreviewProductGridProps = {
  columns?: number;
  limit?: number;
  showFilters?: boolean;
  title?: string;
};

const previewProductCount = 24;
const previewProducts = Array.from(
  { length: previewProductCount },
  (_, index) => ({
    id: `preview-product-${index + 1}`,
    name: `Preview Product ${index + 1}`,
    price: `Sample price ${index + 1}`,
  })
);

export function PreviewProductGrid({
  columns = 3,
  limit = 6,
  showFilters = false,
  title = 'Featured products',
}: PreviewProductGridProps) {
  const productLimit = Math.min(Math.max(limit, 1), previewProducts.length);
  const gridColumns = Math.min(Math.max(columns, 1), 4);
  return (
    <section data-fixture-version="v2" data-testid="builder-preview-products">
      <h2>{title}</h2>
      {showFilters ? (
        <fieldset data-testid="builder-preview-product-filters">
          <legend className="sr-only">Preview product filters</legend>
          <button aria-disabled="true" disabled type="button">
            All products
          </button>
          <button aria-disabled="true" disabled type="button">
            Newest
          </button>
        </fieldset>
      ) : null}
      <div
        className="grid gap-4"
        style={{
          gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))`,
        }}
      >
        {previewProducts.slice(0, productLimit).map((product) => (
          <article className="rounded-md border p-4" key={product.id}>
            <div
              aria-hidden="true"
              className="mb-3 aspect-square rounded bg-muted"
            />
            <h3>{product.name}</h3>
            <p>{product.price}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
