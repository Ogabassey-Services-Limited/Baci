-- Linked blog/product fixture. The explicit position models current ordered links.

DO $setup$
BEGIN
  INSERT INTO public.blog_posts (
    id,
    merchant_id,
    title,
    slug,
    content,
    excerpt,
    category,
    tags,
    keywords,
    author_name,
    status,
    published_at,
    reading_time_minutes
  ) VALUES
    (
      '4d19ab10-0000-4000-8000-000000000010'::uuid,
      '4d19ab10-0000-4000-8000-000000000001'::uuid,
      'Snapshot Phones Buying Guide',
      'snapshot-phones-buying-guide',
      'Compare snapshot phone battery and performance.',
      'Choose the right snapshot phone.',
      'Snapshot Phones',
      ARRAY['snapshot phones'],
      ARRAY['phone', 'battery'],
      'Snapshot Author',
      'published',
      pg_catalog.now() - INTERVAL '1 day',
      5
    ),
    (
      '4d19ab10-0000-4000-8000-000000000011'::uuid,
      '4d19ab10-0000-4000-8000-000000000001'::uuid,
      'Serialized Snapshot Phone Guide',
      'serialized-snapshot-phone-guide',
      'A linked guide for the serialized snapshot phone.',
      'Read the linked product guide.',
      'Snapshot Phones',
      ARRAY['snapshot phones'],
      ARRAY['serialized phone'],
      'Snapshot Author',
      'published',
      pg_catalog.now(),
      4
    );

  INSERT INTO public.blog_post_products (
    merchant_id,
    blog_post_id,
    product_id,
    position
  ) VALUES (
    '4d19ab10-0000-4000-8000-000000000001'::uuid,
    '4d19ab10-0000-4000-8000-000000000011'::uuid,
    '4d19ab10-0000-4000-8000-000000000003'::uuid,
    1
  );
END;
$setup$;
