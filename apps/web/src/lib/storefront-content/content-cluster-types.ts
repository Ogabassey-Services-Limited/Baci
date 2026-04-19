export type SupportedClusterCategory = 'smartphones' | 'laptops' | 'smart-tvs';

export type ContentClusterKind =
  | 'buyer-guide'
  | 'best-in-nigeria'
  | 'troubleshooting'
  | 'decision-support';

export interface PublishedClusterPost {
  slug: string;
  title: string;
  excerpt: string | null;
  category: string | null;
  tags: string[] | null;
  keywords: string[] | null;
  featured_image_url: string | null;
  published_at: string | null;
  reading_time_minutes: number | null;
}

export interface InferredContentClusterContext {
  categorySlug: SupportedClusterCategory | null;
  kind: ContentClusterKind | null;
  brands: string[];
  matchedPriceBands: string[];
  tokens: string[];
}

export interface InformationalGuideLink {
  href: string;
  title: string;
  description: string;
  kind: ContentClusterKind;
}

export type CommercialGuidePageKind =
  | 'category'
  | 'product'
  | 'compare'
  | 'price-band';

export interface BuildCommercialGuideLinksContext {
  pageKind: CommercialGuidePageKind;
  categorySlug: SupportedClusterCategory;
  brands?: string[];
  priceBandSlug?: string;
  productSlugs?: string[];
}

export interface BuildCommercialGuideLinksInput {
  storeUrl: string;
  posts: PublishedClusterPost[];
  context: BuildCommercialGuideLinksContext;
}

export interface InformationalClusterModel {
  heading: string;
  primaryCategoryLink: { href: string; label: string } | null;
  commerceLinks: { href: string; label: string }[];
  featuredProducts: { href: string; title: string; description: string }[];
}

export interface InformationalClusterCategoryData {
  merchant?: { id: string; business_name: string; slug: string };
  category?: { slug?: string | null; name?: string | null };
  products?: Array<{
    slug: string;
    name: string;
    brand?: string | null;
    price: number;
    category_slug?: string | null;
    product_key_specs?: Record<string, unknown> | null;
    condition?: string | null;
    stock?: number | null;
  }>;
  fallbackName?: string | null;
  isCollection?: boolean;
}

export interface BuildInformationalClusterModelInput {
  merchantId: string;
  merchantSlug: string;
  storeUrl: string;
  post: PublishedClusterPost;
  categoryDataOverride?: InformationalClusterCategoryData | null;
}

export interface BlogClusterCollection {
  categorySlug: SupportedClusterCategory;
  heading: string;
  categoryHref: string;
  guides: InformationalGuideLink[];
}
