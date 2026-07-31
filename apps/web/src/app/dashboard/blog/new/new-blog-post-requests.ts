import { fetchWithCsrf } from '@/lib/api-client';
import { sanitizeBlogPostData } from '@/lib/validations/blog';
import type {
  NewBlogPostFormData,
  NewBlogProduct,
} from './new-blog-post-types';

export interface SavedBlogPost {
  id: string;
  slug: string;
}

export async function createBlogPost({
  status,
  formData,
  embeddedProducts,
  merchantId,
}: {
  status: 'draft' | 'published';
  formData: NewBlogPostFormData;
  embeddedProducts: NewBlogProduct[];
  merchantId: string | undefined;
}): Promise<SavedBlogPost> {
  if (!merchantId) {
    throw new Error('Merchant context is still loading. Please try again.');
  }

  const postData = sanitizeBlogPostData({
    title: formData.title.trim(),
    slug: formData.slug || undefined,
    content: formData.content,
    excerpt: formData.excerpt || undefined,
    featured_image_url: formData.featured_image_url || null,
    featured_image_alt: formData.featured_image_alt || undefined,
    featured_image_width: formData.featured_image_url
      ? formData.featured_image_width
      : null,
    featured_image_height: formData.featured_image_url
      ? formData.featured_image_height
      : null,
    featured_image_variants: formData.featured_image_url
      ? formData.featured_image_variants
      : {},
    category: formData.category || undefined,
    tags: formData.tags
      ? formData.tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean)
      : [],
    author_name: formData.author_name,
    author_title: formData.author_title || undefined,
    author_bio: formData.author_bio || undefined,
    seo_title: formData.seo_title || undefined,
    seo_description: formData.seo_description || undefined,
    embedded_products: embeddedProducts.map((product) => product.id),
    status,
  });
  const response = await fetchWithCsrf(
    `/api/merchant/blog/posts?merchantId=${encodeURIComponent(merchantId)}`,
    { method: 'POST', body: JSON.stringify(postData) }
  );
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Failed to create post');
  }
  return response.json();
}
