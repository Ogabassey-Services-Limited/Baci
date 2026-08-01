import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getMerchantBlogRevalidationContext } from '@/lib/get-merchant-blog-cache-identifiers';
import { getMerchantZohoEmailBrand } from '@/lib/merchant-zoho-campaign-settings';
import { createClient } from '@/lib/supabase/server';
import { getConfiguredZohoBlogContentConfig } from '@/lib/zoho-blog-content-config-server';
import { isValidZohoBlogContentSignature } from '@/lib/zoho-blog-content-signature-server';
import { buildZohoBlogEmailHtml } from '@/lib/zoho-blog-email-content';
import { buildStorefrontBlogPostUrl } from '@/lib/zoho-blog-storefront-url-server';

const routeParamsSchema = z.object({
  postId: z.uuid(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  const parsedParams = routeParamsSchema.safeParse(await params);
  if (!parsedParams.success) {
    return NextResponse.json(
      { error: 'Invalid blog post id' },
      { status: 400 }
    );
  }

  const config = getConfiguredZohoBlogContentConfig();
  if (!config.contentSecret) {
    return NextResponse.json(
      { error: 'Zoho Campaigns content signing is not configured' },
      { status: 503 }
    );
  }

  const signature = new URL(request.url).searchParams.get('sig');
  if (
    !isValidZohoBlogContentSignature({
      contentSecret: config.contentSecret,
      postId: parsedParams.data.postId,
      signature,
    })
  ) {
    return NextResponse.json(
      { error: 'Invalid Zoho content signature' },
      { status: 403 }
    );
  }

  const supabase = await createClient();
  const { data: post, error } = await supabase
    .from('blog_posts')
    .select(
      'id, title, slug, content, excerpt, featured_image_url, featured_image_alt, category, merchant_id, status, published_at'
    )
    .eq('id', parsedParams.data.postId)
    .eq('status', 'published')
    .not('published_at', 'is', null)
    .maybeSingle();

  if (error) {
    console.error('Failed to load Zoho blog email content', {
      error: error.message,
      postId: parsedParams.data.postId,
    });
    return NextResponse.json(
      { error: 'Failed to load blog post' },
      { status: 500 }
    );
  }

  if (!post?.slug) {
    return NextResponse.json({ error: 'Blog post not found' }, { status: 404 });
  }

  try {
    const [blogContext, brand] = await Promise.all([
      getMerchantBlogRevalidationContext(supabase, post.merchant_id),
      getMerchantZohoEmailBrand(supabase, post.merchant_id),
    ]);
    const blogUrl = buildStorefrontBlogPostUrl({
      context: blogContext,
      publicBaseUrl: config.publicBaseUrl,
      slug: post.slug,
    });
    const html = buildZohoBlogEmailHtml({ blogUrl, brand, post });

    return new NextResponse(html, {
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=300',
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  } catch (contentError) {
    console.error('Failed to build Zoho blog email content', {
      error:
        contentError instanceof Error ? contentError.message : contentError,
      merchantId: post.merchant_id,
      postId: post.id,
    });
    return NextResponse.json(
      { error: 'Failed to build blog email content' },
      { status: 500 }
    );
  }
}
