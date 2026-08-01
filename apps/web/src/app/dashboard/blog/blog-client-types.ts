export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  featured_image_url: string | null;
  featured_image_width: number | null;
  featured_image_height: number | null;
  featured_image_variants: Record<string, unknown> | null;
  category: string | null;
  status: 'draft' | 'published' | 'archived';
  author_name: string;
  view_count: number;
  reading_time_minutes: number | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

export interface BlogMerchant {
  id: string;
  slug?: string | null;
  custom_domain?: string | null;
}

export interface BlogCounts {
  total: number;
  published: number;
  draft: number;
  archived: number;
}

export interface BlogClientPageProps {
  merchant: BlogMerchant | null;
  initialPosts?: BlogPost[];
  initialCounts?: BlogCounts;
}

export interface UseBlogClientStateOptions {
  initialCounts?: BlogCounts;
  initialPosts: BlogPost[];
  merchant: BlogMerchant;
  useInitialData?: boolean;
}

export interface BlogPostsResponse {
  posts?: BlogPost[];
  hasMore: boolean;
  counts?: BlogCounts;
}

export interface BlogStats {
  total: number;
  published: number;
  drafts: number;
  pageViews: number;
}
