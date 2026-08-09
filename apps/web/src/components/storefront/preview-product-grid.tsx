'use client';

type PreviewProductGridProps = {
  columns?: number;
  limit?: number;
  title?: string;
};

const previewProducts = [
  { id: 'preview-bag', name: 'Canvas Tote', price: '₦12,000' },
  { id: 'preview-notebook', name: 'Studio Notebook', price: '₦6,500' },
  { id: 'preview-bottle', name: 'Everyday Bottle', price: '₦8,000' },
] as const;

export function PreviewProductGrid({
  columns = 3,
  limit = 6,
  title = 'Featured products',
}: PreviewProductGridProps) {
  const productLimit = Math.min(Math.max(limit, 1), previewProducts.length);
  const gridColumns = Math.min(Math.max(columns, 1), 4);
  return (
    <section data-fixture-version="v1" data-testid="builder-preview-products">
      <h2>{title}</h2>
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
