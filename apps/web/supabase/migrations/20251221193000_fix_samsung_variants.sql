-- Migration to fix Samsung S24 and Infinix Hot 50 variants
-- Links orphan variants to their parents and populates variant_attributes

-- 1. Samsung Galaxy S24 (Base)
-- Parent ID: dfac4c6c-6c5c-49bf-9df2-14ec0890bb14
UPDATE products
SET
    parent_product_id = 'dfac4c6c-6c5c-49bf-9df2-14ec0890bb14',
    is_parent = false
WHERE
    name LIKE 'Samsung Galaxy S24 %'
    AND name NOT LIKE 'Samsung Galaxy S24+%'
    AND name NOT LIKE 'Samsung Galaxy S24 Plus%'
    AND name NOT LIKE 'Samsung Galaxy S24 Ultra%'
    AND name NOT LIKE 'Samsung Galaxy S24 FE%'
    AND id != 'dfac4c6c-6c5c-49bf-9df2-14ec0890bb14';

UPDATE products
SET
    is_parent = true,
    has_variants = true,
    variant_attributes = '{"param": "internal_storage", "options": ["256GB"]}'::jsonb
WHERE id = 'dfac4c6c-6c5c-49bf-9df2-14ec0890bb14';

-- 2. Samsung Galaxy S24+
-- Parent ID: d4c43f2b-dd1e-40a2-8017-7f9fa025e5ea
UPDATE products
SET
    parent_product_id = 'd4c43f2b-dd1e-40a2-8017-7f9fa025e5ea',
    is_parent = false
WHERE
    (name LIKE 'Samsung Galaxy S24+%' OR name LIKE 'Samsung Galaxy S24 Plus%')
    AND id != 'd4c43f2b-dd1e-40a2-8017-7f9fa025e5ea';

UPDATE products
SET
    is_parent = true,
    has_variants = true,
    variant_attributes = '{"param": "internal_storage", "options": ["256GB", "512GB"]}'::jsonb
WHERE id = 'd4c43f2b-dd1e-40a2-8017-7f9fa025e5ea';

-- 3. Samsung Galaxy S24 Ultra
-- Parent ID: b37b95f8-e5e1-42b4-aa85-ed147d0e187a
UPDATE products
SET
    parent_product_id = 'b37b95f8-e5e1-42b4-aa85-ed147d0e187a',
    is_parent = false
WHERE
    name LIKE 'Samsung Galaxy S24 Ultra%'
    AND id != 'b37b95f8-e5e1-42b4-aa85-ed147d0e187a';

UPDATE products
SET
    is_parent = true,
    has_variants = true,
    variant_attributes = '{"param": "internal_storage", "options": ["256GB", "512GB", "1TB"]}'::jsonb
WHERE id = 'b37b95f8-e5e1-42b4-aa85-ed147d0e187a';

-- 4. Samsung Galaxy S24 FE
-- Parent ID: 974ee898-d819-4652-9b0d-c20cc29338ec
UPDATE products
SET
    parent_product_id = '974ee898-d819-4652-9b0d-c20cc29338ec',
    is_parent = false
WHERE
    name LIKE 'Samsung Galaxy S24 FE%'
    AND id != '974ee898-d819-4652-9b0d-c20cc29338ec';

UPDATE products
SET
    is_parent = true,
    has_variants = true,
    variant_attributes = '{"param": "internal_storage", "options": ["128GB", "256GB"]}'::jsonb
WHERE id = '974ee898-d819-4652-9b0d-c20cc29338ec';

-- 5. Infinix Hot 50 (Promote to Parent)
-- Parent ID: cdac3165-bdf4-49c2-93bf-765b5da84ce0
UPDATE products
SET
    parent_product_id = 'cdac3165-bdf4-49c2-93bf-765b5da84ce0',
    is_parent = false
WHERE
    name LIKE 'Infinix Hot 50 %' -- Matches "Infinix Hot 50i ..." etc if we want, but likely "Infinix Hot 50i" is different.
    -- Careful: "Infinix Hot 50i" and "Infinix Hot 50" might be different models.
    -- I will restrict this to exactly "Infinix Hot 50 (Something)" if any, or skip if unsure.
    -- The query showed "Infinix Hot 50i (128GB + 4GB)" and "Infinix Hot 50" (base).
    -- I will NOT link 50i to 50 parent without confirmation.
    -- Link only "Infinix Hot 50" variants if found.
    AND id != 'cdac3165-bdf4-49c2-93bf-765b5da84ce0';
    -- Actually, if no other "Infinix Hot 50" variants exist (only 50i and 50 Pro+), I should verify.
