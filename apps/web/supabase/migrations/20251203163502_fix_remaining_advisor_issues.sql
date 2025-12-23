-- Security Fixes
ALTER FUNCTION public.increment_blog_post_views(uuid) SET search_path = '';
ALTER FUNCTION public.get_or_create_merchant_feature_settings(uuid) SET search_path = '';

-- Performance Fixes
CREATE INDEX IF NOT EXISTS idx_platform_blog_posts_author_id ON public.platform_blog_posts(author_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_order_id ON public.product_reviews(order_id);
CREATE INDEX IF NOT EXISTS idx_reorder_suggestions_product_id ON public.reorder_suggestions(product_id);
