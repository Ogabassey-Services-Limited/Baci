-- Category and primary product fixtures for public PDP snapshot assertions.

DO $setup$
BEGIN
  INSERT INTO public.categories (
    id,
    merchant_id,
    name,
    slug,
    parent_id,
    is_active
  ) VALUES
    (
      '4d19ab10-0000-4000-8000-000000000002'::uuid,
      '4d19ab10-0000-4000-8000-000000000001'::uuid,
      'Snapshot Phones',
      'snapshot-phones',
      NULL,
      true
    ),
    (
      '4d19ab10-0000-4000-8000-000000000009'::uuid,
      '4d19ab10-0000-4000-8000-000000000001'::uuid,
      'Snapshot Android Phones',
      'snapshot-android-phones',
      '4d19ab10-0000-4000-8000-000000000002'::uuid,
      true
    ),
    (
      '4d19ab10-0000-4000-8000-000000000013'::uuid,
      '4d19ab10-0000-4000-8000-000000000001'::uuid,
      'Hidden Snapshot Phones',
      'hidden-snapshot-phones',
      NULL,
      false
    );

  INSERT INTO public.products (
    id,
    merchant_id,
    category_id,
    name,
    slug,
    price,
    status,
    has_variants,
    manage_stock,
    stock,
    stock_quantity,
    inventory_tracking_policy,
    images
  ) VALUES
    (
      '4d19ab10-0000-4000-8000-000000000003'::uuid,
      '4d19ab10-0000-4000-8000-000000000001'::uuid,
      '4d19ab10-0000-4000-8000-000000000002'::uuid,
      'Serialized Snapshot Phone',
      'serialized-snapshot-phone',
      100000,
      'active',
      false,
      true,
      99,
      99,
      'serialized_strict',
      '["https://example.com/simple.jpg"]'::jsonb
    ),
    (
      '4d19ab10-0000-4000-8000-000000000005'::uuid,
      '4d19ab10-0000-4000-8000-000000000001'::uuid,
      '4d19ab10-0000-4000-8000-000000000002'::uuid,
      'Variant Snapshot Phone',
      'variant-snapshot-phone',
      200000,
      'active',
      true,
      true,
      99,
      99,
      'serialized_strict',
      '["https://example.com/variant.jpg"]'::jsonb
    ),
    (
      '4d19ab10-0000-4000-8000-000000000008'::uuid,
      '4d19ab10-0000-4000-8000-000000000001'::uuid,
      '4d19ab10-0000-4000-8000-000000000009'::uuid,
      'Child Category Snapshot Phone',
      'child-category-snapshot-phone',
      150000,
      'active',
      false,
      false,
      5,
      5,
      'off',
      '["https://example.com/child.jpg"]'::jsonb
    ),
    (
      '4d19ab10-0000-4000-8000-000000000014'::uuid,
      '4d19ab10-0000-4000-8000-000000000001'::uuid,
      '4d19ab10-0000-4000-8000-000000000013'::uuid,
      'Hidden Category Snapshot Phone',
      'hidden-category-snapshot-phone',
      175000,
      'active',
      false,
      false,
      5,
      5,
      'off',
      '["https://example.com/hidden.jpg"]'::jsonb
    ),
    (
      '4d19ab10-0000-4000-8000-000000000015'::uuid,
      '4d19ab10-0000-4000-8000-000000000001'::uuid,
      '4d19ab10-0000-4000-8000-000000000002'::uuid,
      'Blank Slug Snapshot Parent',
      '   ',
      225000,
      'active',
      false,
      false,
      5,
      5,
      'off',
      '["https://example.com/blank-parent.jpg"]'::jsonb
    ),
    (
      '4d19ab10-0000-4000-8000-000000000017'::uuid,
      '4d19ab10-0000-4000-8000-000000000001'::uuid,
      '4d19ab10-0000-4000-8000-000000000002'::uuid,
      'Large Variant Snapshot Phone',
      'large-variant-snapshot-phone',
      250000,
      'active',
      true,
      true,
      130,
      130,
      'off',
      '["https://example.com/large-variant.jpg"]'::jsonb
    ),
    (
      '4d19ab10-0000-4000-8000-000000000019'::uuid,
      '4d19ab10-0000-4000-8000-000000000001'::uuid,
      '4d19ab10-0000-4000-8000-000000000002'::uuid,
      'Long Slug Snapshot Phone',
      -- 220 bytes: above the old 200-byte snapshot bound, within the
      -- 255-decoded-char safety gate and 512-byte preflight route contract.
      'long-slug-' || pg_catalog.repeat('x', 210),
      120000,
      'active',
      false,
      false,
      5,
      5,
      'off',
      '["https://example.com/long-slug.jpg"]'::jsonb
    );
END;
$setup$;
