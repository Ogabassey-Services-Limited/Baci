import { NextResponse } from 'next/server';

/**
 * Adds cache control headers to the response based on the request path and user agent.
 *
 * @param response - The NextResponse object to modify
 * @param pathname - The current request path
 * @param userAgent - The user agent string from the request
 */
export function applyCacheHeaders(
    response: NextResponse,
    pathname: string,
    userAgent: string
): NextResponse {
    // Detect bots/crawlers for optimized SEO caching
    const isBot =
        /bot|crawler|spider|crawling|googlebot|bingbot|slurp|duckduckbot|baiduspider|yandexbot|facebookexternalhit|twitterbot|rogerbot|linkedinbot|embedly|quora link preview|showyoubot|outbrain|pinterest|slackbot|vkShare|W3C_Validator/i.test(
            userAgent
        );

    // Add cache headers for static assets
    if (
        pathname.startsWith('/_next/static') ||
        pathname.startsWith('/images') ||
        pathname.match(/\.(jpg|jpeg|png|gif|svg|ico|webp|woff|woff2|ttf|eot)$/)
    ) {
        response.headers.set(
            'Cache-Control',
            'public, max-age=31536000, immutable'
        );
        return response;
    }

    // Cache product feed APIs - longer for bots
    if (
        pathname.startsWith('/api/feed/google-merchant') ||
        pathname.startsWith('/api/feed/facebook') ||
        pathname.startsWith('/api/feed/tiktok')
    ) {
        response.headers.set(
            'Cache-Control',
            isBot
                ? 's-maxage=7200, stale-while-revalidate=172800'
                : 's-maxage=3600, stale-while-revalidate=86400'
        );
        return response;
    }

    // Cache storefront product pages: /merchant/products/slug or /merchant/category/slug
    // Regex strictly matches 3-level paths that are NOT dashboard/api/auth
    if (
        pathname.match(/^\/[^/]+\/products\/[^/]+$/) ||
        (pathname.match(/^\/[^/]+\/[^/]+\/[^/]+$/) &&
            !pathname.startsWith('/dashboard') &&
            !pathname.startsWith('/api') &&
            !pathname.startsWith('/auth'))
    ) {
        response.headers.set(
            'Cache-Control',
            isBot
                ? 's-maxage=3600, stale-while-revalidate=86400'
                : 's-maxage=300, stale-while-revalidate=3600'
        );
        return response;
    }

    // Cache category pages
    if (
        pathname.match(/^\/[^/]+\/[^/]+\/?$/) &&
        !pathname.startsWith('/dashboard') &&
        !pathname.startsWith('/api') &&
        !pathname.startsWith('/auth')
    ) {
        response.headers.set(
            'Cache-Control',
            isBot
                ? 's-maxage=1800, stale-while-revalidate=7200'
                : 's-maxage=300, stale-while-revalidate=3600'
        );
        return response;
    }

    // Cache storefront home pages
    if (
        pathname.match(/^\/[^/]+\/?$/) &&
        !pathname.startsWith('/dashboard') &&
        !pathname.startsWith('/api') &&
        !pathname.startsWith('/auth')
    ) {
        response.headers.set(
            'Cache-Control',
            isBot
                ? 's-maxage=600, stale-while-revalidate=3600'
                : 's-maxage=60, stale-while-revalidate=300'
        );
        return response;
    }

    // No cache for authenticated routes and APIs (default safety)
    if (
        pathname.startsWith('/dashboard') ||
        pathname.startsWith('/api') ||
        pathname.startsWith('/builder')
    ) {
        response.headers.set(
            'Cache-Control',
            'no-cache, must-revalidate, max-age=0'
        );
        return response;
    }

    return response;
}
