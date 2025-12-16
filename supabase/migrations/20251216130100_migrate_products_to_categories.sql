-- Migrate existing products from TEXT category to category_id
-- This maps the old flat text categories to the new hierarchical structure

-- 1. Map Phones
UPDATE products p
SET category_id = c.id
FROM categories c
WHERE c.slug = 'phones'
AND (
  p.category ILIKE '%phone%'
  OR p.category ILIKE '%smartphone%'
)
AND p.category_id IS NULL;

-- 2. Map Laptops
UPDATE products p
SET category_id = c.id
FROM categories c
WHERE c.slug = 'laptops'
AND (
  p.category ILIKE '%laptop%'
  OR p.category ILIKE '%macbook%'
  OR p.category ILIKE '%notebook%'
)
AND p.category_id IS NULL;

-- 3. Map Tablets
UPDATE products p
SET category_id = c.id
FROM categories c
WHERE c.slug = 'tablets'
AND (
  p.category ILIKE '%tablet%'
  OR p.category ILIKE '%ipad%'
)
AND p.category_id IS NULL;

-- 4. Map Gaming - PlayStation 5
UPDATE products p
SET category_id = c.id
FROM categories c
WHERE c.slug = 'playstation-5'
AND (
  p.category ILIKE '%playstation 5%'
  OR p.category ILIKE '%ps5%'
)
AND p.category_id IS NULL;

-- 5. Map Gaming - PlayStation 4
UPDATE products p
SET category_id = c.id
FROM categories c
WHERE c.slug = 'playstation-4'
AND (
  p.category ILIKE '%playstation 4%'
  OR p.category ILIKE '%ps4%'
)
AND p.category_id IS NULL;

-- 6. Map Gaming - Xbox
UPDATE products p
SET category_id = c.id
FROM categories c
WHERE c.slug = 'xbox'
AND p.category ILIKE '%xbox%'
AND p.category_id IS NULL;

-- 7. Map Gaming - Nintendo
UPDATE products p
SET category_id = c.id
FROM categories c
WHERE c.slug = 'nintendo'
AND p.category ILIKE '%nintendo%'
AND p.category_id IS NULL;

-- 8. Map Gaming - VR Headsets
UPDATE products p
SET category_id = c.id
FROM categories c
WHERE c.slug = 'vr-headsets'
AND (
  p.category ILIKE '%vr%'
  OR p.category ILIKE '%virtual reality%'
  OR p.category ILIKE '%quest%'
)
AND p.category_id IS NULL;

-- 9. Map TVs - Samsung
UPDATE products p
SET category_id = c.id
FROM categories c
WHERE c.slug = 'samsung-tvs'
AND p.category ILIKE '%samsung%tv%'
AND p.category_id IS NULL;

-- 10. Map TVs - LG
UPDATE products p
SET category_id = c.id
FROM categories c
WHERE c.slug = 'lg-tvs'
AND p.category ILIKE '%lg%tv%'
AND p.category_id IS NULL;

-- 11. Map Audio - Headphones
UPDATE products p
SET category_id = c.id
FROM categories c
WHERE c.slug = 'headphones'
AND (
  p.category ILIKE '%headphone%'
  OR (p.category ILIKE '%audio%' AND p.name ILIKE '%headphone%')
)
AND p.category_id IS NULL;

-- 12. Map Audio - Earbuds
UPDATE products p
SET category_id = c.id
FROM categories c
WHERE c.slug = 'earbuds'
AND (
  p.category ILIKE '%earbud%'
  OR p.category ILIKE '%earphone%'
  OR p.name ILIKE '%buds%'
  OR p.name ILIKE '%airpods%'
)
AND p.category_id IS NULL;

-- 13. Map Audio - Soundbars
UPDATE products p
SET category_id = c.id
FROM categories c
WHERE c.slug = 'soundbars'
AND (
  p.category ILIKE '%soundbar%'
  OR p.name ILIKE '%soundbar%'
)
AND p.category_id IS NULL;

-- 14. Map remaining Audio to parent Audio category
UPDATE products p
SET category_id = c.id
FROM categories c
WHERE c.slug = 'audio'
AND p.category ILIKE '%audio%'
AND p.category_id IS NULL;

-- 15. Map Wearables - Smartwatches
UPDATE products p
SET category_id = c.id
FROM categories c
WHERE c.slug = 'smartwatches'
AND (
  p.category ILIKE '%smartwatch%'
  OR p.category ILIKE '%watch%'
  OR p.name ILIKE '%watch%'
)
AND p.category_id IS NULL;

-- 16. Map remaining Wearables
UPDATE products p
SET category_id = c.id
FROM categories c
WHERE c.slug = 'wearables'
AND (
  p.category ILIKE '%wearable%'
  OR p.category ILIKE '%fitness%'
  OR p.name ILIKE '%fit%band%'
  OR p.name ILIKE '%galaxy fit%'
)
AND p.category_id IS NULL;

-- 17. Map Accessories
UPDATE products p
SET category_id = c.id
FROM categories c
WHERE c.slug = 'accessories'
AND (
  p.category ILIKE '%accessor%'
  OR p.category ILIKE '%case%'
  OR p.category ILIKE '%charger%'
  OR p.category ILIKE '%cable%'
  OR p.name ILIKE '%tag%'
  OR p.name ILIKE '%tracker%'
)
AND p.category_id IS NULL;

-- 18. Map Printers
UPDATE products p
SET category_id = c.id
FROM categories c
WHERE c.slug = 'printers'
AND (
  p.category ILIKE '%printer%'
  OR p.name ILIKE '%printer%'
)
AND p.category_id IS NULL;

-- 19. Map generic "Gaming" category to parent Gaming
UPDATE products p
SET category_id = c.id
FROM categories c
WHERE c.slug = 'gaming'
AND p.category ILIKE 'gaming'
AND p.category_id IS NULL;

-- 20. Update product counts on categories
UPDATE categories c
SET product_count = (
  SELECT COUNT(*)
  FROM products p
  WHERE p.category_id = c.id
);

-- 21. Log unmapped products for review
DO $$
DECLARE
  unmapped_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO unmapped_count
  FROM products
  WHERE category_id IS NULL AND category IS NOT NULL;

  IF unmapped_count > 0 THEN
    RAISE NOTICE 'Products with unmapped categories: %', unmapped_count;
  END IF;
END $$;
