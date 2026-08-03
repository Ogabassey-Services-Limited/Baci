export type StorefrontProductUrlInput = {
  slug?: string;
  name: string;
  category?: string | null;
  categories?: { name?: string; slug?: string } | null;
  category_slug?: string | null;
  categorySlug?: string;
  canonical_url?: string | null;
  condition?: 'new' | 'used' | string;
  condition_detail?: string;
  id: string;
};
