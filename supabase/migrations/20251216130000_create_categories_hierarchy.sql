-- Create categories table with hierarchy support
-- Following Koray's framework: clear parent-child relationships, ≤3 clicks from homepage

-- 1. Create the categories table
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  description TEXT,
  seo_title TEXT,
  seo_description TEXT,
  image_url TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  product_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_is_active ON categories(is_active) WHERE is_active = true;

-- 3. Add category_id to products table (keeping old category TEXT for migration)
ALTER TABLE products ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);

-- 4. Insert parent categories (top-level)
INSERT INTO categories (slug, name, description, seo_title, seo_description, display_order) VALUES
  ('phones', 'Phones', 'Smartphones from top brands including Samsung, Apple, Xiaomi, and more', 'Buy Phones in Nigeria | OgaBassey', 'Shop the latest smartphones in Nigeria. Samsung, iPhone, Xiaomi & more with flexible payment options.', 1),
  ('laptops', 'Laptops', 'Laptops for work, gaming, and everyday use from HP, Dell, Apple, Lenovo, and more', 'Buy Laptops in Nigeria | OgaBassey', 'Shop laptops in Nigeria. MacBooks, HP, Dell, Lenovo & gaming laptops with BNPL options.', 2),
  ('tablets', 'Tablets', 'Tablets and iPads for productivity and entertainment', 'Buy Tablets in Nigeria | OgaBassey', 'Shop tablets in Nigeria. iPads, Samsung tablets & more with flexible payment.', 3),
  ('gaming', 'Gaming', 'Gaming consoles, accessories, and VR headsets', 'Gaming Consoles in Nigeria | OgaBassey', 'Shop PlayStation, Xbox, Nintendo & VR headsets in Nigeria with BNPL options.', 4),
  ('tvs', 'TVs', 'Smart TVs and displays from Samsung, LG, and more', 'Buy Smart TVs in Nigeria | OgaBassey', 'Shop Samsung, LG smart TVs in Nigeria. 4K, OLED & QLED with flexible payment.', 5),
  ('audio', 'Audio', 'Headphones, earbuds, soundbars, and speakers', 'Audio & Headphones in Nigeria | OgaBassey', 'Shop headphones, earbuds, soundbars in Nigeria. JBL, Samsung, Apple & more.', 6),
  ('wearables', 'Wearables', 'Smartwatches and fitness trackers', 'Smartwatches in Nigeria | OgaBassey', 'Shop Apple Watch, Samsung Galaxy Watch & fitness trackers in Nigeria.', 7),
  ('accessories', 'Accessories', 'Phone cases, chargers, cables, and more', 'Phone Accessories in Nigeria | OgaBassey', 'Shop phone accessories in Nigeria. Cases, chargers, screen protectors & more.', 8),
  ('printers', 'Printers', 'Printers and printing supplies', 'Buy Printers in Nigeria | OgaBassey', 'Shop HP, Canon, Epson printers in Nigeria with flexible payment options.', 9)
ON CONFLICT (slug) DO NOTHING;

-- 5. Insert child categories under Gaming
INSERT INTO categories (slug, name, parent_id, description, display_order)
SELECT
  child.slug,
  child.name,
  p.id,
  child.description,
  child.display_order
FROM categories p
CROSS JOIN (VALUES
  ('playstation-5', 'PlayStation 5', 'PS5 consoles and bundles', 1),
  ('playstation-4', 'PlayStation 4', 'PS4 consoles and bundles', 2),
  ('xbox', 'Xbox', 'Xbox consoles and bundles', 3),
  ('nintendo', 'Nintendo', 'Nintendo Switch consoles and games', 4),
  ('vr-headsets', 'VR Headsets', 'Virtual reality headsets and accessories', 5)
) AS child(slug, name, description, display_order)
WHERE p.slug = 'gaming'
ON CONFLICT (slug) DO NOTHING;

-- 6. Insert child categories under TVs
INSERT INTO categories (slug, name, parent_id, description, display_order)
SELECT
  child.slug,
  child.name,
  p.id,
  child.description,
  child.display_order
FROM categories p
CROSS JOIN (VALUES
  ('samsung-tvs', 'Samsung TVs', 'Samsung Smart TVs - QLED, Neo QLED, Crystal UHD', 1),
  ('lg-tvs', 'LG TVs', 'LG Smart TVs - OLED, NanoCell, UHD', 2)
) AS child(slug, name, description, display_order)
WHERE p.slug = 'tvs'
ON CONFLICT (slug) DO NOTHING;

-- 7. Insert child categories under Audio
INSERT INTO categories (slug, name, parent_id, description, display_order)
SELECT
  child.slug,
  child.name,
  p.id,
  child.description,
  child.display_order
FROM categories p
CROSS JOIN (VALUES
  ('headphones', 'Headphones', 'Over-ear and on-ear headphones', 1),
  ('earbuds', 'Earbuds', 'Wireless earbuds and in-ear headphones', 2),
  ('soundbars', 'Soundbars', 'Soundbars and home audio systems', 3)
) AS child(slug, name, description, display_order)
WHERE p.slug = 'audio'
ON CONFLICT (slug) DO NOTHING;

-- 8. Insert child categories under Wearables
INSERT INTO categories (slug, name, parent_id, description, display_order)
SELECT
  child.slug,
  child.name,
  p.id,
  child.description,
  child.display_order
FROM categories p
CROSS JOIN (VALUES
  ('smartwatches', 'Smartwatches', 'Smart watches from Apple, Samsung, and more', 1),
  ('fitness-trackers', 'Fitness Trackers', 'Fitness bands and activity trackers', 2)
) AS child(slug, name, description, display_order)
WHERE p.slug = 'wearables'
ON CONFLICT (slug) DO NOTHING;

-- 9. Function to get category path (for breadcrumbs)
CREATE OR REPLACE FUNCTION get_category_path(category_id UUID)
RETURNS TABLE(id UUID, slug TEXT, name TEXT, level INTEGER) AS $$
WITH RECURSIVE category_path AS (
  SELECT c.id, c.slug, c.name, c.parent_id, 1 as level
  FROM categories c
  WHERE c.id = category_id

  UNION ALL

  SELECT c.id, c.slug, c.name, c.parent_id, cp.level + 1
  FROM categories c
  INNER JOIN category_path cp ON c.id = cp.parent_id
)
SELECT cp.id, cp.slug, cp.name, cp.level
FROM category_path cp
ORDER BY cp.level DESC;
$$ LANGUAGE SQL STABLE;

-- 10. Function to get all descendants of a category
CREATE OR REPLACE FUNCTION get_category_descendants(parent_category_id UUID)
RETURNS TABLE(id UUID, slug TEXT, name TEXT, level INTEGER) AS $$
WITH RECURSIVE descendants AS (
  SELECT c.id, c.slug, c.name, 1 as level
  FROM categories c
  WHERE c.parent_id = parent_category_id

  UNION ALL

  SELECT c.id, c.slug, c.name, d.level + 1
  FROM categories c
  INNER JOIN descendants d ON c.parent_id = d.id
)
SELECT * FROM descendants;
$$ LANGUAGE SQL STABLE;

-- 11. Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_categories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW
  EXECUTE FUNCTION update_categories_updated_at();

-- 12. Comments
COMMENT ON TABLE categories IS 'Hierarchical product categories with parent-child relationships';
COMMENT ON COLUMN categories.parent_id IS 'Reference to parent category, NULL for top-level categories';
COMMENT ON COLUMN categories.slug IS 'URL-friendly identifier, used in routes like /gaming/playstation-5';
COMMENT ON FUNCTION get_category_path IS 'Returns the full path from root to given category (for breadcrumbs)';
COMMENT ON FUNCTION get_category_descendants IS 'Returns all child categories recursively (for filtering)';
