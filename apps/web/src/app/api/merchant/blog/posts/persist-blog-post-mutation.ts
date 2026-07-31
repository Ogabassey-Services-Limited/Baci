import type { SupabaseClient } from '@supabase/supabase-js';
import { BLOG_POST_MUTATION_PROJECTION } from './blog-post-mutation-projection';

type BlogPostMutationRecord = {
  category: string | null;
  content: string;
  excerpt: string | null;
  featured_image_url: string | null;
  id: string;
  merchant_id: string;
  published_at: string | null;
  slug: string;
  status: string;
  title: string;
};

type PersistBlogPostMutationInput = {
  embeddedProductIds: string[] | undefined;
  merchantId: string;
  postData: Record<string, unknown>;
  postId: string | null;
  supabase: SupabaseClient;
};

type PersistBlogPostMutationResult =
  | { error: null; post: BlogPostMutationRecord; status: null }
  | { error: string; post: null; status: 400 | 500 };

function readString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function readNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function readMutationPost({
  fallback,
  merchantId,
  value,
}: {
  fallback: Record<string, unknown>;
  merchantId: string;
  value: unknown;
}): BlogPostMutationRecord | null {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== 'object' || Array.isArray(row)) return null;

  const post = row as Record<string, unknown>;
  if (typeof post.id !== 'string') return null;

  return {
    category: readNullableString(
      Object.hasOwn(post, 'category') ? post.category : fallback.category
    ),
    content: readString(post.content, readString(fallback.content)),
    excerpt: readNullableString(
      Object.hasOwn(post, 'excerpt') ? post.excerpt : fallback.excerpt
    ),
    featured_image_url: readNullableString(
      Object.hasOwn(post, 'featured_image_url')
        ? post.featured_image_url
        : fallback.featured_image_url
    ),
    id: post.id,
    merchant_id: readString(post.merchant_id, merchantId),
    published_at: readNullableString(
      Object.hasOwn(post, 'published_at')
        ? post.published_at
        : fallback.published_at
    ),
    slug: readString(post.slug, readString(fallback.slug)),
    status: readString(post.status, readString(fallback.status, 'draft')),
    title: readString(post.title, readString(fallback.title)),
  };
}

export async function persistBlogPostMutation({
  embeddedProductIds,
  merchantId,
  postData,
  postId,
  supabase,
}: PersistBlogPostMutationInput): Promise<PersistBlogPostMutationResult> {
  if (embeddedProductIds === undefined) {
    const mutation = postId
      ? supabase
          .from('blog_posts')
          .update(postData)
          .eq('id', postId)
          .eq('merchant_id', merchantId)
      : supabase.from('blog_posts').insert(postData);
    const { data, error } = await mutation
      .select(BLOG_POST_MUTATION_PROJECTION)
      .single();

    const post = readMutationPost({
      fallback: postData,
      merchantId,
      value: data,
    });
    if (error || !post) {
      return {
        error: postId
          ? 'Failed to update post'
          : (error?.message ?? 'Failed to create post'),
        post: null,
        status: 500,
      };
    }

    return { error: null, post, status: null };
  }

  if (embeddedProductIds.length > 0) {
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id')
      .eq('merchant_id', merchantId)
      .in('id', embeddedProductIds);
    if (productsError) {
      console.error('Failed to validate embedded blog products:', {
        merchantId,
        error: productsError,
      });
      return {
        error: 'Failed to validate embedded products',
        post: null,
        status: 500,
      };
    }

    const ownedProductIds = new Set(
      (products ?? []).flatMap((product) =>
        product && typeof product.id === 'string' ? [product.id] : []
      )
    );
    if (ownedProductIds.size !== embeddedProductIds.length) {
      return {
        error: 'One or more embedded products do not belong to this merchant',
        post: null,
        status: 400,
      };
    }
  }

  const { data, error } = await supabase.rpc(
    'mutate_merchant_blog_post_with_product_links',
    {
      p_merchant_id: merchantId,
      p_post_data: postData,
      p_post_id: postId,
      p_product_ids: embeddedProductIds,
    }
  );
  const post = readMutationPost({
    fallback: postData,
    merchantId,
    value: data,
  });
  if (error || !post) {
    const invalidProduct =
      error?.code === 'P0002' ||
      error?.message === 'embedded_product_not_found_or_not_owned';
    console.error('Failed to persist embedded blog products:', {
      merchantId,
      postId,
      error,
    });
    return {
      error: invalidProduct
        ? 'One or more embedded products do not belong to this merchant'
        : postId
          ? 'Failed to update post'
          : 'Failed to create post',
      post: null,
      status: invalidProduct ? 400 : 500,
    };
  }

  return { error: null, post, status: null };
}
