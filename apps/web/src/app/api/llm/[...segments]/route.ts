import {
  getCachedBlogListing,
  getCachedBlogPost,
  getCachedCategoryPageData,
  getCachedProductWithDetails,
  getMerchantByIdentifier,
} from '@/lib/cached-data';
import {
  buildBlogIndexMarkdown,
  buildBlogPostMarkdown,
  buildCategoryMarkdown,
  buildProductMarkdown,
  buildStorefrontAboutMarkdown,
  buildStorefrontContactMarkdown,
  buildStorefrontFaqMarkdown,
  buildStorefrontHomeMarkdown,
  markdownResponse,
  notFoundMarkdownResponse,
} from '@/lib/llms-markdown';
import {
  filterPublicBlogCategories,
  filterPublicBlogPosts,
} from '@/lib/public-blog-content-quality';

function notFound() {
  return notFoundMarkdownResponse('# Not Found\n');
}

/**
 * Unified LLM markdown endpoint.
 *
 * Replaces per-page `.md` route handlers that previously lived inside the
 * `(storefront)/[slug]/` route tree. Those directory names (e.g.
 * `index.html.md/`) caused a Next.js routing collision with the dynamic
 * `[category]` segment, breaking the storefront homepage on custom domains.
 *
 * The proxy rewrites `.md` requests to this handler:
 *   /ogabassey/index.html.md  →  /api/llm/ogabassey
 *   /ogabassey/about.md       →  /api/llm/ogabassey/about
 *   /ogabassey/blog/post.md   →  /api/llm/ogabassey/blog/post
 *   /ogabassey/shoes/index.html.md → /api/llm/ogabassey/shoes
 *   /ogabassey/shoes/nike.md  →  /api/llm/ogabassey/shoes/nike
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ segments: string[] }> }
) {
  try {
    return await handleLlmRequest(request, context);
  } catch (err) {
    console.error('[LLM API] Unhandled error', err);
    return notFound();
  }
}

async function handleLlmRequest(
  request: Request,
  context: { params: Promise<{ segments: string[] }> }
) {
  const { segments } = await context.params;
  const host = request.headers.get('host') ?? new URL(request.url).host;
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
  const origin = `${protocol}://${host}`;

  // Minimum: /api/llm/[slug]
  if (segments.length === 0) {
    return notFound();
  }

  const slug = segments[0];
  const merchant = await getMerchantByIdentifier(slug);
  if (!merchant) {
    return notFound();
  }

  // 1 segment: /api/llm/[slug] → storefront home
  if (segments.length === 1) {
    return markdownResponse(buildStorefrontHomeMarkdown(merchant, origin));
  }

  const page = segments[1];

  // 2 segments: /api/llm/[slug]/[page]
  if (segments.length === 2) {
    switch (page) {
      case 'about':
        return markdownResponse(buildStorefrontAboutMarkdown(merchant, origin));

      case 'contact':
        if (!merchant.pages?.contact && !merchant.email && !merchant.phone)
          return notFound();
        return markdownResponse(
          buildStorefrontContactMarkdown(merchant, origin)
        );

      case 'faq': {
        return markdownResponse(buildStorefrontFaqMarkdown(merchant, origin));
      }

      case 'blog': {
        const data = await getCachedBlogListing(slug);
        const publicPosts = data ? filterPublicBlogPosts(data.posts) : [];
        if (!data || publicPosts.length === 0) return notFound();
        return markdownResponse(
          buildBlogIndexMarkdown(
            data.merchant,
            origin,
            publicPosts,
            filterPublicBlogCategories(data.categories)
          )
        );
      }

      default:
        // Treat as category
        return serveCategoryMarkdown(merchant, slug, origin, page);
    }
  }

  // 3 segments: /api/llm/[slug]/[section]/[item]
  if (segments.length === 3) {
    const section = segments[1];
    const item = segments[2];

    if (section === 'blog') {
      const data = await getCachedBlogPost(slug, item);
      if (!data) return notFound();
      return markdownResponse(
        buildBlogPostMarkdown(data.merchant, origin, data.post)
      );
    }

    // section = category, item = product slug
    const product = await getCachedProductWithDetails(merchant.id, item);
    if (!product) return notFound();
    return markdownResponse(buildProductMarkdown(merchant, origin, product));
  }

  return notFound();
}

async function serveCategoryMarkdown(
  merchant: NonNullable<Awaited<ReturnType<typeof getMerchantByIdentifier>>>,
  slug: string,
  origin: string,
  category: string
) {
  const data = await getCachedCategoryPageData(merchant.id, category, slug);
  if (!data || !Array.isArray(data.products) || data.products.length === 0) {
    return notFound();
  }
  return markdownResponse(
    buildCategoryMarkdown(merchant, origin, category, data)
  );
}
