-- Migration to fix iPhone 16 family variants
-- Links orphan variants to their parents and populates variant_attributes

-- 1. iPhone 16 (Base)
-- Parent ID: 094152bc-689b-4c27-8901-325a2ecce92d
UPDATE products
SET
    parent_product_id = '094152bc-689b-4c27-8901-325a2ecce92d',
    is_parent = false
WHERE
    name LIKE 'iPhone 16 %'
    AND name NOT LIKE 'iPhone 16 Plus%'
    AND name NOT LIKE 'iPhone 16 Pro%'
    AND name NOT LIKE 'iPhone 16E%'
    AND id != '094152bc-689b-4c27-8901-325a2ecce92d';

UPDATE products
SET
    is_parent = true,
    has_variants = true,
    variant_attributes = '{"param": "internal_storage", "options": ["128GB", "256GB", "512GB"]}'::jsonb
WHERE id = '094152bc-689b-4c27-8901-325a2ecce92d';

-- 2. iPhone 16 Plus
-- Parent ID: e69eaaf4-74a9-41d7-83fd-5219d24082ba
UPDATE products
SET
    parent_product_id = 'e69eaaf4-74a9-41d7-83fd-5219d24082ba',
    is_parent = false
WHERE
    name LIKE 'iPhone 16 Plus %'
    AND id != 'e69eaaf4-74a9-41d7-83fd-5219d24082ba';

UPDATE products
SET
    is_parent = true,
    has_variants = true,
    variant_attributes = '{"param": "internal_storage", "options": ["128GB", "256GB", "512GB"]}'::jsonb
WHERE id = 'e69eaaf4-74a9-41d7-83fd-5219d24082ba';

-- 3. iPhone 16 Pro
-- Parent ID: d828ef4e-4b72-49e1-8c6e-96c2071a47ff
UPDATE products
SET
    parent_product_id = 'd828ef4e-4b72-49e1-8c6e-96c2071a47ff',
    is_parent = false
WHERE
    name LIKE 'iPhone 16 Pro %'
    AND name NOT LIKE 'iPhone 16 Pro Max%'
    AND id != 'd828ef4e-4b72-49e1-8c6e-96c2071a47ff';

UPDATE products
SET
    is_parent = true,
    has_variants = true,
    variant_attributes = '{"param": "internal_storage", "options": ["128GB", "256GB", "512GB", "1TB"]}'::jsonb
WHERE id = 'd828ef4e-4b72-49e1-8c6e-96c2071a47ff';

-- 4. iPhone 16 Pro Max
-- Parent ID: 84ccc7a9-64d8-422c-a6db-18f4bc4f7244
UPDATE products
SET
    parent_product_id = '84ccc7a9-64d8-422c-a6db-18f4bc4f7244',
    is_parent = false
WHERE
    name LIKE 'iPhone 16 Pro Max %'
    AND id != '84ccc7a9-64d8-422c-a6db-18f4bc4f7244';

UPDATE products
SET
    is_parent = true,
    has_variants = true,
    variant_attributes = '{"param": "internal_storage", "options": ["256GB", "512GB", "1TB"]}'::jsonb
WHERE id = '84ccc7a9-64d8-422c-a6db-18f4bc4f7244';

-- 5. iPhone 16E
-- Parent ID: b68350f2-21d5-4914-b7e5-5c32aa203684
UPDATE products
SET
    parent_product_id = 'b68350f2-21d5-4914-b7e5-5c32aa203684',
    is_parent = false
WHERE
    name LIKE 'iPhone 16E %'
    AND id != 'b68350f2-21d5-4914-b7e5-5c32aa203684';

UPDATE products
SET
    is_parent = true,
    has_variants = true,
    variant_attributes = '{"param": "internal_storage", "options": ["128GB", "256GB"]}'::jsonb
WHERE id = 'b68350f2-21d5-4914-b7e5-5c32aa203684';
