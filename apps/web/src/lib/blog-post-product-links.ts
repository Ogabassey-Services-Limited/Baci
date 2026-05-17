export const BLOG_POST_PRODUCT_LINKS_SELECT =
  'product_id, blog_post_id, relationship, blog_posts(id, title, slug, excerpt, featured_image_url, category, reading_time_minutes)' as const;

export interface BlogPostProductLinkPost {
  id: string | null;
  title: string | null;
  slug: string | null;
  excerpt: string | null;
  featured_image_url: string | null;
  category: string | null;
  reading_time_minutes: number | null;
}

export interface BlogPostProductLinkRow {
  product_id: string | null;
  blog_post_id: string | null;
  relationship: string | null;
  blog_posts: BlogPostProductLinkPost | BlogPostProductLinkPost[] | null;
}

export interface LinkedBlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  featured_image_url: string | null;
  category: string | null;
  reading_time_minutes: number | null;
}

export function normalizeBlogPostProductLink(
  row: BlogPostProductLinkRow
): LinkedBlogPost | null {
  const post = Array.isArray(row.blog_posts)
    ? row.blog_posts[0]
    : row.blog_posts;

  if (!post?.id || !post.title || !post.slug) {
    return null;
  }

  return {
    id: post.id,
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    featured_image_url: post.featured_image_url,
    category: post.category,
    reading_time_minutes: post.reading_time_minutes,
  };
}
