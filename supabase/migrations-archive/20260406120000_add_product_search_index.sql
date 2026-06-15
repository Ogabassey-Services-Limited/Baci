-- Add GIN index for full-text search on products
-- Covers name, brand, category for fast websearch queries

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS search_vector tsvector
    GENERATED ALWAYS AS (
      to_tsvector('english',
        coalesce(name, '') || ' ' ||
        coalesce(brand, '') || ' ' ||
        coalesce(category, '')
      )
    ) STORED;

CREATE INDEX IF NOT EXISTS products_search_vector_gin
  ON products USING GIN (search_vector);
