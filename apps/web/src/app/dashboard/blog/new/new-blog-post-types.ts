import type { BlogFeaturedVariantKey } from '@/lib/blog-managed-storage-paths';

export interface NewBlogProduct {
  id: string;
  name: string;
  price: number;
  compare_at_price?: number;
  images: string[];
  slug: string;
  status: string;
}

export type FeaturedImageVariants = Partial<
  Record<BlogFeaturedVariantKey, string>
>;
export type FeaturedImageVariantPaths = Partial<
  Record<BlogFeaturedVariantKey, string>
>;

export interface NewBlogPostFormData {
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  featured_image_url: string;
  featured_image_alt: string;
  featured_image_width: number | null;
  featured_image_height: number | null;
  featured_image_variants: FeaturedImageVariants;
  category: string;
  tags: string;
  author_name: string;
  author_title: string;
  author_bio: string;
  seo_title: string;
  seo_description: string;
}

export interface UploadedFeaturedImage {
  path: string;
  variantPaths: FeaturedImageVariantPaths;
}
