-- Add SKU to product full-text search vector
-- SKU is a common search term for merchants managing inventory

ALTER TABLE products
  DROP COLUMN IF EXISTS search_vector;

ALTER TABLE products
  ADD COLUMN search_vector tsvector
    GENERATED ALWAYS AS (
      to_tsvector('english',
        coalesce(name, '') || ' ' ||
        coalesce(brand, '') || ' ' ||
        coalesce(category, '') || ' ' ||
        coalesce(sku, '')
      )
    ) STORED;

-- Recreate GIN index (dropped with column)
CREATE INDEX IF NOT EXISTS products_search_vector_gin
  ON products USING GIN (search_vector);
