import { type NextRequest, NextResponse } from 'next/server';
import { resolveSelectedMerchantAccess } from '@/app/api/merchant/features/resolve-selected-merchant-access';
import { authenticateApiRequest, hasPermission } from '@/lib/api-auth';
import {
  validateBlogDiscoverImageReadiness,
  validateBlogImageVariantIntegrity,
} from '@/lib/blog-discover-readiness';
import {
  calculateReadingTime,
  calculateWordCount,
  extractKeywords,
  generateExcerpt,
  generateSeoDescription,
  generateSlug,
} from '@/lib/blog-utils';
import { revalidateBlogPosts } from '@/lib/cache-revalidation';
import { checkCsrfProtection } from '@/lib/csrf';
import { getBlogEmbeddingText } from '@/lib/embeddings';
import { getMerchantBlogRevalidationContext } from '@/lib/get-merchant-blog-cache-identifiers';
import { createPostSchema, sanitizeBlogPostData } from '@/lib/validations/blog';
import { BLOG_POST_MUTATION_PROJECTION } from './blog-post-mutation-projection';
import { scheduleCreatedPostPublicationEffects } from './post-publication-effects';

export async function createBlogPost(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request);
    if (auth.error || !auth.user || !auth.supabase) {
      return NextResponse.json(
        { error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }
    const { valid, response } = await checkCsrfProtection(request);
    if (!valid) {
      return (
        response ??
        NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
      );
    }
    const selectedMerchant = await resolveSelectedMerchantAccess({
      requestedMerchantId: request.nextUrl.searchParams.get('merchantId'),
      supabase: auth.supabase,
      userId: auth.user.id,
    });
    if (selectedMerchant.invalidMerchantId) {
      return NextResponse.json(
        { error: 'Invalid merchant ID' },
        { status: 400 }
      );
    }
    if (!selectedMerchant.access) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }
    const access = selectedMerchant.access;
    if (!hasPermission(access, 'marketing', 'edit')) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const { data: merchantData, error: merchantError } = await auth.supabase
      .from('merchants')
      .select('business_name, slug')
      .eq('id', access.merchantId)
      .single();
    if (merchantError) {
      console.error(
        'Failed to fetch merchant details for blog post creation:',
        {
          merchantId: access.merchantId,
          error: merchantError,
        }
      );
      return NextResponse.json(
        { error: 'Failed to load merchant details' },
        { status: 500 }
      );
    }
    if (!merchantData?.slug) {
      console.warn(
        'Merchant slug missing during blog post revalidation; falling back to available blog identifiers only',
        { merchantId: access.merchantId }
      );
    }
    const merchant = {
      id: access.merchantId,
      business_name: merchantData?.business_name || 'Store Owner',
    };
    const { data: features, error: featuresError } = await auth.supabase
      .from('merchant_feature_settings')
      .select('blog_enabled, blog_discover_image_validation_enabled')
      .eq('merchant_id', merchant.id)
      .maybeSingle();
    if (featuresError) {
      console.error('Failed to fetch blog feature settings:', {
        merchantId: merchant.id,
        error: featuresError,
      });
      return NextResponse.json(
        { error: 'Failed to load blog settings' },
        { status: 500 }
      );
    }
    if (!features?.blog_enabled) {
      return NextResponse.json(
        {
          error:
            'Blog feature is not enabled. Enable it in Settings > Features.',
        },
        { status: 403 }
      );
    }

    const body = sanitizeBlogPostData(await request.json());
    if (!body.slug && body.title) body.slug = generateSlug(String(body.title));
    if (!body.author_name) body.author_name = merchant.business_name;
    const validated = createPostSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validated.error.flatten() },
        { status: 400 }
      );
    }
    const postData = validated.data;
    const variantIntegrity = validateBlogImageVariantIntegrity(
      postData,
      merchant.id
    );
    if (!variantIntegrity.ready) {
      return NextResponse.json(
        {
          error: 'Invalid featured image variants',
          code: variantIntegrity.code,
          details: variantIntegrity.details,
        },
        { status: 400 }
      );
    }
    const discoverImageReadiness =
      postData.status === 'published'
        ? validateBlogDiscoverImageReadiness(postData, merchant.id)
        : { ready: true as const };
    if (
      !discoverImageReadiness.ready &&
      features.blog_discover_image_validation_enabled
    ) {
      return NextResponse.json(
        {
          error: 'Featured image is not Discover-ready',
          code: discoverImageReadiness.code,
          details: discoverImageReadiness.details,
        },
        { status: 400 }
      );
    }
    const { data: existingPost, error: existingPostError } = await auth.supabase
      .from('blog_posts')
      .select('id')
      .eq('merchant_id', merchant.id)
      .eq('slug', postData.slug)
      .maybeSingle();
    if (existingPostError) {
      console.error('Failed to validate blog post slug:', {
        merchantId: merchant.id,
        slug: postData.slug,
        error: existingPostError,
      });
      return NextResponse.json(
        { error: 'Failed to validate post slug' },
        { status: 500 }
      );
    }
    if (existingPost) {
      return NextResponse.json(
        { error: 'A post with this slug already exists' },
        { status: 409 }
      );
    }
    const autoExcerpt = postData.excerpt || generateExcerpt(postData.content);
    const autoKeywords = postData.keywords?.length
      ? postData.keywords
      : extractKeywords(postData.title, postData.content);
    const insertData = {
      merchant_id: merchant.id,
      title: postData.title,
      slug: postData.slug,
      content: postData.content,
      excerpt: autoExcerpt,
      featured_image_url: postData.featured_image_url,
      featured_image_width: postData.featured_image_width,
      featured_image_height: postData.featured_image_height,
      featured_image_variants: postData.featured_image_variants ?? {},
      featured_image_alt: postData.featured_image_alt,
      category: postData.category,
      tags: postData.tags || [],
      keywords: autoKeywords,
      author_name: postData.author_name,
      author_title: postData.author_title,
      author_image_url: postData.author_image_url,
      author_bio: postData.author_bio,
      status: postData.status || 'draft',
      seo_title: postData.seo_title || postData.title.substring(0, 70),
      seo_description:
        postData.seo_description || generateSeoDescription(postData.content),
      focus_keyword:
        postData.focus_keyword ||
        (autoKeywords.length > 0 ? autoKeywords[0] : undefined),
      word_count: calculateWordCount(postData.content),
      reading_time_minutes: calculateReadingTime(postData.content),
      published_at:
        postData.status === 'published' ? new Date().toISOString() : null,
    };
    const { data: newPost, error: insertError } = await auth.supabase
      .from('blog_posts')
      .insert(insertData)
      .select(BLOG_POST_MUTATION_PROJECTION)
      .single();
    if (insertError) {
      console.error('Error creating blog post:', insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
    if (newPost?.id) {
      const embeddingText = getBlogEmbeddingText({
        title: postData.title,
        excerpt: autoExcerpt,
        content: postData.content,
        category: postData.category,
      });
      void auth.supabase.functions
        .invoke('generate-embedding', {
          body: {
            id: newPost.id,
            text: embeddingText,
            type: 'blog',
          },
        })
        .then(({ error }) => {
          if (error) console.error('Failed to generate blog embedding:', error);
        })
        .catch((error) =>
          console.error('Failed to generate blog embedding:', error)
        );
    }
    let blogRevalidation:
      | Awaited<ReturnType<typeof getMerchantBlogRevalidationContext>>
      | undefined;
    try {
      blogRevalidation = await getMerchantBlogRevalidationContext(
        auth.supabase,
        access.merchantId
      );
      revalidateBlogPosts({
        merchantId: access.merchantId,
        identifiers: blogRevalidation.identifiers,
        canonicalMerchantSlug: blogRevalidation.canonicalMerchantSlug,
        listingCategories: newPost?.category ? [newPost.category] : [],
        postSlugs: [newPost?.slug || postData.slug],
      });
    } catch (error) {
      console.error('Failed post-publication blog revalidation:', {
        merchantId: access.merchantId,
        postSlug: newPost?.slug || postData.slug,
        error,
      });
    }
    if (newPost?.status === 'published') {
      scheduleCreatedPostPublicationEffects({
        blogRevalidation,
        post: newPost,
        supabase: auth.supabase,
      });
    }
    return NextResponse.json(
      discoverImageReadiness.ready
        ? newPost
        : { ...newPost, discoverImageReadiness },
      { status: 201 }
    );
  } catch (error) {
    console.error('Blog posts POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
