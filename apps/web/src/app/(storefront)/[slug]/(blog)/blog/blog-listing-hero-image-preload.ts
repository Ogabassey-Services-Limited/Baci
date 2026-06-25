import 'server-only';
import { getBlogListingImageSrc } from '@/components/storefront/ogabassey/pages/blog-listing-image-src';
import { OGABASSEY_TEMPLATE_ID } from '@/config/templates';
import { preloadBlogListingFeaturedImage } from './blog-listing-featured-image-preload';

interface BlogListingHeroPost {
  featured?: boolean;
  featured_image_url?: string | null;
}

interface BlogListingHeroImagePreloadOptions {
  category?: string;
  posts: readonly BlogListingHeroPost[];
  searchQuery?: string;
  templateId?: string | null;
}

function getBlogListingHeroPost(posts: readonly BlogListingHeroPost[]) {
  return posts.find((post) => post.featured === true) ?? posts[0];
}

export function preloadOgabasseyRootBlogListingHeroImage({
  category,
  posts,
  searchQuery,
  templateId,
}: BlogListingHeroImagePreloadOptions): void {
  if (templateId !== OGABASSEY_TEMPLATE_ID || category || searchQuery) {
    return;
  }

  preloadBlogListingFeaturedImage(
    getBlogListingImageSrc(getBlogListingHeroPost(posts)?.featured_image_url)
  );
}
