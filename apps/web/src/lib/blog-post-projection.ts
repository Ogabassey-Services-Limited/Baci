export const BLOG_POST_PUBLIC_PROJECTION =
  'id, title, slug, content, excerpt, featured_image_url, featured_image_alt, category, tags, keywords, author_name, author_title, author_image_url, author_bio, reading_time_minutes, published_at, view_count, seo_title, seo_description' as const;

export const BLOG_POST_DETAIL_PROJECTION =
  'id, merchant_id, title, slug, content, excerpt, featured_image_url, featured_image_alt, category, tags, keywords, author_name, author_title, author_image_url, author_bio, status, seo_title, seo_description, focus_keyword, reading_time_minutes, view_count, word_count, created_at, updated_at, published_at, is_ai_generated, ai_topic_id, is_platform_post' as const;
