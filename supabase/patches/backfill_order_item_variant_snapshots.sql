-- Backfill missing order item variant snapshots using deterministic matches only.
-- Priority:
-- 1. Existing variant_id -> derive variant_name from product_variants.attributes
-- 2. Products with exactly one variant -> attach that variant
-- 3. Unique price match between order_items.price and product_variants.price_override/base product price
-- 4. Unique attribute-text match in the stored order item name
--
-- This intentionally skips ambiguous rows so we do not invent variant or colour data.

with candidate_items as (
  select
    oi.id as order_item_id,
    oi.order_id,
    oi.product_id,
    oi.variant_id,
    oi.price,
    lower(coalesce(oi.name, '')) as order_item_name
  from public.order_items oi
  join public.products p on p.id = oi.product_id
  where p.has_variants = true
    and (oi.variant_name is null or btrim(oi.variant_name) = '')
),
direct_variant_matches as (
  select
    ci.order_item_id,
    pv.id as resolved_variant_id,
    public.format_order_item_variant_name(pv.attributes) as resolved_variant_name,
    1 as priority
  from candidate_items ci
  join public.product_variants pv on pv.id = ci.variant_id
),
only_variant_products as (
  select distinct on (product_id)
    product_id,
    id as variant_id
  from public.product_variants
  order by product_id, id
),
single_variant_matches as (
  select
    ci.order_item_id,
    pv.id as resolved_variant_id,
    public.format_order_item_variant_name(pv.attributes) as resolved_variant_name,
    2 as priority
  from candidate_items ci
  join (
    select product_id
    from public.product_variants
    group by product_id
    having count(*) = 1
  ) single_variant_products on single_variant_products.product_id = ci.product_id
  join only_variant_products ovp on ovp.product_id = ci.product_id
  join public.product_variants pv on pv.id = ovp.variant_id
  where ci.variant_id is null
),
unique_price_matches as (
  select
    order_item_id,
    variant_id as resolved_variant_id,
    variant_name as resolved_variant_name,
    3 as priority
  from (
    select
      ci.order_item_id,
      pv.id as variant_id,
      public.format_order_item_variant_name(pv.attributes) as variant_name,
      row_number() over (partition by ci.order_item_id order by pv.id) as row_num,
      count(*) over (partition by ci.order_item_id) as candidate_count
    from candidate_items ci
    join public.products p on p.id = ci.product_id
    join public.product_variants pv on pv.product_id = ci.product_id
    where ci.variant_id is null
      and coalesce(pv.price_override, p.price) = ci.price
  ) matches
  where candidate_count = 1
    and row_num = 1
),
unique_attribute_matches as (
  select
    order_item_id,
    variant_id as resolved_variant_id,
    variant_name as resolved_variant_name,
    4 as priority
  from (
    select
      ci.order_item_id,
      pv.id as variant_id,
      public.format_order_item_variant_name(pv.attributes) as variant_name,
      row_number() over (partition by ci.order_item_id order by pv.id) as row_num,
      count(*) over (partition by ci.order_item_id) as candidate_count
    from candidate_items ci
    join public.product_variants pv on pv.product_id = ci.product_id
    where ci.variant_id is null
      and ci.order_item_name <> ''
      and not exists (
        select 1
        from jsonb_each_text(pv.attributes) attr
        where position(lower(attr.value) in ci.order_item_name) = 0
      )
  ) matches
  where candidate_count = 1
    and row_num = 1
),
resolved_matches as (
  select distinct on (order_item_id)
    order_item_id,
    resolved_variant_id,
    resolved_variant_name
  from (
    select * from direct_variant_matches
    union all
    select * from single_variant_matches
    union all
    select * from unique_price_matches
    union all
    select * from unique_attribute_matches
  ) all_matches
  order by order_item_id, priority
),
updated as (
  update public.order_items oi
  set
    variant_id = coalesce(oi.variant_id, rm.resolved_variant_id),
    variant_name = rm.resolved_variant_name
  from resolved_matches rm
  where oi.id = rm.order_item_id
    and (oi.variant_name is null or btrim(oi.variant_name) = '')
  returning oi.id, oi.order_id, oi.variant_id, oi.variant_name
)
select count(*) as updated_rows
from updated;
