import { NextRequest, NextResponse } from 'next/server';
import {
    CLICK_ID_PARAMS,
    extractClickIdsFromUrl,
    generateClickIdCookies,
} from '@/lib/ad-tracking-cookies';
import { RouteType } from './routes';
import { applyCacheHeaders } from './cache';

/**
 * Generate Content Security Policy based on route type
 * Multi-tenant strategy:
 * - Admin/Auth: Nonce-based CSP (strict, requires SSR)
 * - Storefront: Relaxed CSP (allows ISR/SSG caching)
 */
export function generateCSP(routeType: RouteType, nonce?: string): string {
    const baseDirectives = {
        'default-src': "'self'",
        'img-src': "'self' blob: data: https:",
        'font-src': "'self' data: https://fonts.gstatic.com",
        'object-src': "'none'",
        'base-uri': "'self'",
        'upgrade-insecure-requests': '',
    };

    if (routeType === 'admin' || routeType === 'auth') {
        // Strict nonce-based CSP for admin and authentication routes
        return Object.entries({
            ...baseDirectives,
            // strict-dynamic allows nonced scripts to load additional scripts dynamically (CSP Level 3)
            'script-src': `'self' 'nonce-${nonce}' 'strict-dynamic' https://vercel.live https://va.vercel-scripts.com`,
            'style-src': "'self' 'unsafe-inline' https://fonts.googleapis.com",
            'connect-src':
                "'self' https://*.supabase.co wss://*.supabase.co https://api.korapay.com https://generativelanguage.googleapis.com https://vercel.live https://vitals.vercel-insights.com",
            'frame-src': "'self' https://checkout.korapay.com",
            'form-action': "'self'",
            'frame-ancestors': "'self'",
        })
            .map(([key, value]) => `${key} ${value}`.trim())
            .join('; ');
    }

    if (routeType === 'storefront') {
        // Relaxed CSP for merchant storefronts (allows ISR/SSG)
        return Object.entries({
            ...baseDirectives,
            'script-src':
                "'self' 'unsafe-inline' https://vercel.live https://va.vercel-scripts.com",
            'style-src': "'self' 'unsafe-inline' https://fonts.googleapis.com",
            'connect-src':
                "'self' https://*.supabase.co https://vitals.vercel-insights.com",
        })
            .map(([key, value]) => `${key} ${value}`.trim())
            .join('; ');
    }

    // Basic CSP for API routes
    return Object.entries({
        'default-src': "'self'",
        'object-src': "'none'",
    })
        .map(([key, value]) => `${key} ${value}`.trim())
        .join('; ');
}

/**
 * Capture ad click IDs from URL params and set cookies
 * This enables better conversion attribution when sending offline conversions
 */
function captureAdClickIds(request: NextRequest, response: NextResponse): void {
    const searchParams = request.nextUrl.searchParams;

    // Check if any click ID params exist
    const hasClickIds = Object.keys(CLICK_ID_PARAMS).some((param) =>
        searchParams.has(param)
    );

    if (!hasClickIds) return;

    // Extract click IDs from URL
    const clickIds = extractClickIdsFromUrl(searchParams);

    // Generate cookies
    const cookies = generateClickIdCookies(clickIds);

    // Set cookies on response
    for (const cookie of cookies) {
        response.headers.append('Set-Cookie', cookie);
    }
}

/**
 * Apply security headers, CSP, and cache headers to the response
 */
export function applySecurityHeaders(
    response: NextResponse,
    pathname: string,
    userAgent: string,
    routeType: RouteType,
    nonce?: string,
    request?: NextRequest
): NextResponse {
    // Capture ad click IDs from URL params (if request provided)
    if (request && routeType === 'storefront') {
        captureAdClickIds(request, response);
    }

    // Apply Content Security Policy
    const csp = generateCSP(routeType, nonce);
    response.headers.set('Content-Security-Policy', csp);

    // Set nonce in request header for server components (admin/auth routes only)
    if (nonce) {
        response.headers.set('x-nonce', nonce);
    }

    // HSTS: Enforce HTTPS with subdomains and preload (Lighthouse Best Practice)
    response.headers.set(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains; preload'
    );

    // COOP: Isolate top-level window from cross-origin documents (Lighthouse Best Practice)
    response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');

    // COEP: Cross-Origin Embedder Policy for SharedArrayBuffer support
    // Note: 'credentialless' is more compatible than 'require-corp'
    response.headers.set('Cross-Origin-Embedder-Policy', 'credentialless');

    // Apply cache headers (separated logic)
    return applyCacheHeaders(response, pathname, userAgent);
}
