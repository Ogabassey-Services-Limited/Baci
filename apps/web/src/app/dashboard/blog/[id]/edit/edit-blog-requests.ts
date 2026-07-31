import { fetchWithCsrf } from '@/lib/api-client';
import { sanitizeBlogPostData } from '@/lib/validations/blog';
import { normalizeFeaturedImageVariantMap } from './edit-blog-form-data';
import type { BlogPost, PostFormData, Product } from './edit-blog-types';

type FetchedBlogPost = Omit<BlogPost, 'tags' | 'keywords'> & {
  tags?: unknown;
  keywords?: unknown;
  embedded_products?: unknown;
};

export type LoadBlogPostResult =
  | { status: 'not-found' }
  | { status: 'error' }
  | {
      status: 'success';
      post: BlogPost;
      formData: PostFormData;
      embeddedProducts: Product[] | null;
      productsLoadFailed: boolean;
    };

function toFormData(post: FetchedBlogPost): PostFormData {
  return {
    title: post.title || '',
    slug: post.slug || '',
    content: post.content || '',
    excerpt: post.excerpt || '',
    featured_image_url: post.featured_image_url || '',
    featured_image_alt: post.featured_image_alt || '',
    featured_image_width: post.featured_image_width ?? null,
    featured_image_height: post.featured_image_height ?? null,
    featured_image_variants: normalizeFeaturedImageVariantMap(
      post.featured_image_variants
    ),
    category: post.category || '',
    tags: Array.isArray(post.tags) ? post.tags.join(', ') : '',
    keywords: Array.isArray(post.keywords) ? post.keywords.join(', ') : '',
    author_name: post.author_name || '',
    author_title: post.author_title || '',
    author_bio: post.author_bio || '',
    seo_title: post.seo_title || '',
    seo_description: post.seo_description || '',
    focus_keyword: post.focus_keyword || '',
    status: post.status || 'draft',
    published_at: post.published_at || null,
  };
}

export async function loadBlogPost(
  postId: string,
  merchantId: string
): Promise<LoadBlogPostResult> {
  try {
    const response = await fetch(
      `/api/merchant/blog/posts/${postId}?merchantId=${encodeURIComponent(merchantId)}`
    );
    if (!response.ok)
      return response.status === 404
        ? { status: 'not-found' }
        : { status: 'error' };
    const post = (await response.json()) as FetchedBlogPost;
    let embeddedProducts: Product[] | null = null;
    let productsLoadFailed = false;
    try {
      if (
        Array.isArray(post.embedded_products) &&
        post.embedded_products.length > 0
      ) {
        const productsResponse = await fetch(
          `/api/products?ids=${post.embedded_products.join(',')}&merchantId=${encodeURIComponent(merchantId)}`
        );
        if (productsResponse.ok)
          embeddedProducts =
            ((await productsResponse.json()) as { products?: Product[] })
              .products || [];
      }
    } catch (error) {
      console.error('Error fetching post:', error);
      productsLoadFailed = true;
    }
    return {
      status: 'success',
      post: post as BlogPost,
      formData: toFormData(post),
      embeddedProducts,
      productsLoadFailed,
    };
  } catch (error) {
    console.error('Error fetching post:', error);
    return { status: 'error' };
  }
}

interface SubmitBlogPostUpdateArgs {
  postId: string;
  merchantId: string;
  formData: PostFormData;
  originalSlug?: string;
  newStatus?: PostFormData['status'];
  scheduledDate?: Date;
  embeddedProductIds: string[];
}

export async function submitBlogPostUpdate({
  postId,
  merchantId,
  formData,
  originalSlug,
  newStatus,
  scheduledDate,
  embeddedProductIds,
}: SubmitBlogPostUpdateArgs): Promise<BlogPost> {
  const postData = sanitizeBlogPostData({
    title: formData.title.trim(),
    slug:
      formData.slug && formData.slug !== originalSlug
        ? formData.slug
        : undefined,
    content: formData.content,
    excerpt: formData.excerpt,
    featured_image_url: formData.featured_image_url,
    featured_image_alt: formData.featured_image_alt,
    featured_image_width: formData.featured_image_url
      ? formData.featured_image_width
      : null,
    featured_image_height: formData.featured_image_url
      ? formData.featured_image_height
      : null,
    featured_image_variants: formData.featured_image_url
      ? formData.featured_image_variants
      : {},
    category: formData.category,
    tags: formData.tags ? formData.tags.split(',') : [],
    keywords: formData.keywords ? formData.keywords.split(',') : [],
    author_name: formData.author_name,
    author_title: formData.author_title,
    author_bio: formData.author_bio,
    seo_title: formData.seo_title,
    seo_description: formData.seo_description,
    focus_keyword: formData.focus_keyword,
    status: newStatus || formData.status,
    published_at:
      newStatus === 'scheduled'
        ? scheduledDate?.toISOString()
        : newStatus === 'published'
          ? new Date().toISOString()
          : formData.published_at,
    embedded_products: embeddedProductIds,
  });
  const response = await fetchWithCsrf(
    `/api/merchant/blog/posts/${postId}?merchantId=${encodeURIComponent(merchantId)}`,
    { method: 'PATCH', body: JSON.stringify(postData) }
  );
  if (!response.ok) {
    const data = (await response.json()) as {
      error?: string;
      details?: { fieldErrors?: Record<string, string[]> };
    };
    throw new Error(
      data.details?.fieldErrors
        ? Object.values(data.details.fieldErrors)[0]?.[0] ||
            'Failed to update post'
        : data.error || 'Failed to update post'
    );
  }
  return (await response.json()) as BlogPost;
}
