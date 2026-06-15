-- Migration to add iPhone 17 Pro Max variants from Google Sheet source
-- Parent ID: 663958ad-945b-418f-a84f-bb272656f721

INSERT INTO products (
    name,
    slug,
    parent_product_id,
    price,
    status,
    stock,
    images,
    specifications,
    manage_stock,
    merchant_id
) VALUES
-- 256GB Variants
(
    'iPhone 17 Pro Max 256GB E-Sim (New)',
    'iphone-17-pro-max-256gb-esim-new',
    '663958ad-945b-418f-a84f-bb272656f721',
    1850000,
    'active',
    5,
    '[]'::jsonb,
    '{"general": {"internal_storage": "256GB", "condition": "New", "sim_type": "E-Sim"}}'::jsonb,
    true,
    '6b5cb8a4-5575-456c-b936-8cdfae30db74'
),
(
    'iPhone 17 Pro Max 256GB Wifi Only (New)',
    'iphone-17-pro-max-256gb-wifi-only-new',
    '663958ad-945b-418f-a84f-bb272656f721',
    1270000,
    'active',
    5,
    '[]'::jsonb,
    '{"general": {"internal_storage": "256GB", "condition": "New", "connectivity": "Wifi Only"}}'::jsonb,
    true,
    '6b5cb8a4-5575-456c-b936-8cdfae30db74'
),

-- 512GB Variants
(
    'iPhone 17 Pro Max 512GB Physical Sim (New)',
    'iphone-17-pro-max-512gb-physical-sim-new',
    '663958ad-945b-418f-a84f-bb272656f721',
    2480000,
    'active',
    5,
    '[]'::jsonb,
    '{"general": {"internal_storage": "512GB", "condition": "New", "sim_type": "Physical Sim"}}'::jsonb,
    true,
    '6b5cb8a4-5575-456c-b936-8cdfae30db74'
),
(
    'iPhone 17 Pro Max 512GB ESim (New)',
    'iphone-17-pro-max-512gb-esim-new',
    '663958ad-945b-418f-a84f-bb272656f721',
    2200000,
    'active',
    5,
    '[]'::jsonb,
    '{"general": {"internal_storage": "512GB", "condition": "New", "sim_type": "E-Sim"}}'::jsonb,
    true,
    '6b5cb8a4-5575-456c-b936-8cdfae30db74'
),
(
    'iPhone 17 Pro Max 512GB Wifi Only (New)',
    'iphone-17-pro-max-512gb-wifi-only-new',
    '663958ad-945b-418f-a84f-bb272656f721',
    1380000,
    'active',
    5,
    '[]'::jsonb,
    '{"general": {"internal_storage": "512GB", "condition": "New", "connectivity": "Wifi Only"}}'::jsonb,
    true,
    '6b5cb8a4-5575-456c-b936-8cdfae30db74'
),

-- 1TB Variants
(
    'iPhone 17 Pro Max 1TB Physical Sim (New)',
    'iphone-17-pro-max-1tb-physical-sim-new',
    '663958ad-945b-418f-a84f-bb272656f721',
    2930000,
    'active',
    5,
    '[]'::jsonb,
    '{"general": {"internal_storage": "1TB", "condition": "New", "sim_type": "Physical Sim"}}'::jsonb,
    true,
    '6b5cb8a4-5575-456c-b936-8cdfae30db74'
),
(
    'iPhone 17 Pro Max 1TB ESim (New)',
    'iphone-17-pro-max-1tb-esim-new',
    '663958ad-945b-418f-a84f-bb272656f721',
    2550000,
    'active',
    5,
    '[]'::jsonb,
    '{"general": {"internal_storage": "1TB", "condition": "New", "sim_type": "E-Sim"}}'::jsonb,
    true,
    '6b5cb8a4-5575-456c-b936-8cdfae30db74'
),

-- 2TB Variant (Future Spec)
(
    'iPhone 17 Pro Max 2TB Physical Sim (New)',
    'iphone-17-pro-max-2tb-physical-sim-new',
    '663958ad-945b-418f-a84f-bb272656f721',
    3480000,
    'active',
    5,
    '[]'::jsonb,
    '{"general": {"internal_storage": "2TB", "condition": "New", "sim_type": "Physical Sim"}}'::jsonb,
    true,
    '6b5cb8a4-5575-456c-b936-8cdfae30db74'
);

-- Update Parent to have correct variant attributes
UPDATE products
SET variant_attributes = '{"param": "internal_storage", "options": ["256GB", "512GB", "1TB", "2TB"]}'::jsonb
WHERE id = '663958ad-945b-418f-a84f-bb272656f721';
