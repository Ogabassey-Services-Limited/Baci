const CACHE_CONTROL = 'public, max-age=3600, s-maxage=3600';

function createMarkdownResponse(body: string): Response {
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': CACHE_CONTROL,
      'X-Robots-Tag': 'noarchive',
    },
  });
}

export function markdownResponse(body: string): Response {
  return createMarkdownResponse(body);
}

export function notFoundMarkdownResponse(message: string): Response {
  return new Response(message, {
    status: 404,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=60, s-maxage=60',
      'X-Robots-Tag': 'noindex, noarchive',
    },
  });
}

export {
  buildBlogIndexMarkdown,
  buildBlogPostMarkdown,
} from '@/lib/llms-markdown-blog';
export {
  buildPlatformFeaturesMarkdown,
  buildPlatformHomeMarkdown,
  buildPlatformOnboardingMarkdown,
  buildPlatformPricingMarkdown,
} from '@/lib/llms-markdown-platform';
export {
  buildCategoryMarkdown,
  buildProductMarkdown,
  buildStorefrontAboutMarkdown,
  buildStorefrontContactMarkdown,
  buildStorefrontFaqMarkdown,
  buildStorefrontHomeMarkdown,
} from '@/lib/llms-markdown-storefront';
