-- Migration to repair Infinix product variants (v3 with storage regex)

DO $$
DECLARE
    v_merchant_id UUID;
BEGIN
    -- 0. Get Merchant ID
    SELECT merchant_id INTO v_merchant_id FROM products WHERE name ILIKE 'Infinix%' LIMIT 1;

    -- Fallback if no Infinix exists (unlikely given previous queries)
    IF v_merchant_id IS NULL THEN
         SELECT merchant_id INTO v_merchant_id FROM products LIMIT 1;
    END IF;

    -- Helper temporary table to define mappings
    CREATE TEMP TABLE infinix_mappings (
        parent_name TEXT,
        parent_slug TEXT,
        child_pattern TEXT
    );

    INSERT INTO infinix_mappings (parent_name, parent_slug, child_pattern) VALUES
    ('Infinix GT 30 Pro', 'infinix-gt-30-pro', 'Infinix GT 30 Pro (%'),
    ('Infinix Hot 50i', 'infinix-hot-50i', 'Infinix Hot 50i (%'),
    ('Infinix Hot 50 Pro+', 'infinix-hot-50-pro-plus', 'Infinix Hot 50 Pro+ (%'),
    ('Infinix Hot 60 Pro', 'infinix-hot-60-pro', 'Infinix Hot 60 Pro (%'),
    ('Infinix Hot 60i', 'infinix-hot-60i', 'Infinix Hot 60i (%'),
    ('Infinix Note 50', 'infinix-note-50', 'Infinix Note 50 (%'),
    ('Infinix Smart 10', 'infinix-smart-10', 'Infinix Smart 10 (%'),
    ('Infinix Smart 10 HD', 'infinix-smart-10-hd', 'Infinix Smart 10 HD (%'),
    ('Infinix Smart 10 Plus', 'infinix-smart-10-plus', 'Infinix Smart 10 Plus (%'),
    ('Infinix Smart 9 HD', 'infinix-smart-9-hd', 'Infinix Smart 9 HD (%');

    -- 1. Create Missing Parents
    INSERT INTO products (name, slug, description, price, status, is_parent, has_variants, variant_attributes, merchant_id)
    SELECT
        m.parent_name,
        m.parent_slug,
        m.parent_name || ' - Smartphone',
        0, -- Default price
        'active',
        true,
        true,
        '{"colors": [], "storage": []}'::jsonb,
        v_merchant_id
    FROM infinix_mappings m
    WHERE NOT EXISTS (SELECT 1 FROM products p WHERE p.slug = m.parent_slug);

    -- 2. Update Existing Parents (if they exist but aren't marked as parents)
    UPDATE products
    SET is_parent = true, has_variants = true
    WHERE slug IN (
        'infinix-hot-50',
        'infinix-smart-8',
        'infinix-smart-9',
        'infinix-xpad',
        'infinix-zero-flip',
        'infinix-hot-60-pro-plus'
    );

    -- 3. Link Orphans to Parents
    UPDATE products child
    SET parent_product_id = parent.id
    FROM products parent, infinix_mappings m
    WHERE parent.slug = m.parent_slug
    AND child.name ILIKE m.child_pattern
    AND child.parent_product_id IS NULL;

    -- 4. Update Variant Attributes for Newly Linked Parents
    WITH aggregated AS (
      SELECT
        p.id AS parent_id,
        jsonb_build_object(
          'colors', jsonb_agg(DISTINCT c.color) FILTER (WHERE c.color IS NOT NULL),
          'storage', jsonb_agg(DISTINCT substring(c.name from '(\d+GB|\d+TB)')) FILTER (WHERE substring(c.name from '(\d+GB|\d+TB)') IS NOT NULL)
        ) AS new_attributes
      FROM products p
      JOIN products c ON c.parent_product_id = p.id
      WHERE p.name ILIKE 'Infinix%'
      GROUP BY p.id
    )
    UPDATE products p
    SET variant_attributes = a.new_attributes
    FROM aggregated a
    WHERE p.id = a.parent_id;

END $$;
