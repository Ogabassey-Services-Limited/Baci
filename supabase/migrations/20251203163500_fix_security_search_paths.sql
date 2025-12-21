ALTER FUNCTION public.update_updated_at_column() SET search_path = '';
ALTER FUNCTION public.generate_inventory_snapshot(uuid) SET search_path = '';
ALTER FUNCTION public.update_loyalty_timestamp() SET search_path = '';
ALTER FUNCTION public.calculate_loyalty_tier(integer, uuid) SET search_path = '';
ALTER FUNCTION public.redeem_points(uuid, uuid, integer, uuid) SET search_path = '';
ALTER FUNCTION public.update_blog_category_post_count() SET search_path = '';
