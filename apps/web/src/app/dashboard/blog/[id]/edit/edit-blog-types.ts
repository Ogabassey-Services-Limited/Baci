import type { BlogFeaturedVariantKey } from '@/lib/blog-managed-storage-paths';

export interface Product {
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

export interface PostFormData {
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
  keywords: string;
  author_name: string;
  author_title: string;
  author_bio: string;
  seo_title: string;
  seo_description: string;
  focus_keyword: string;
  status: 'draft' | 'published' | 'archived' | 'scheduled';
  published_at?: string | null;
}

export interface BlogPost extends PostFormData {
  id: string;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  view_count: number;
  word_count: number;
  reading_time_minutes: number;
}

export interface UploadedFeaturedImage {
  path: string;
  variantPaths: FeaturedImageVariantPaths;
}

export interface MerchantPreviewData {
  id?: string;
  slug?: string;
  custom_domain?: string | null;
}
