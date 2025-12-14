export type RouteType = 'admin' | 'auth' | 'storefront' | 'api';

/**
 * Classify route type for selective security policies
 * - Admin routes: Dashboard, builder, onboarding (strict CSP with nonce)
 * - Auth routes: Login, signup, password reset (strict CSP with nonce)
 * - Storefront routes: Public merchant pages (relaxed CSP for ISR/SSG)
 * - API routes: Backend endpoints (basic CSP)
 */
export function getRouteType(pathname: string): RouteType {
    // Admin/Dashboard routes
    if (
        pathname.startsWith('/dashboard') ||
        pathname.startsWith('/builder') ||
        pathname.startsWith('/onboarding') ||
        pathname.startsWith('/admin')
    ) {
        return 'admin';
    }

    // Authentication routes
    if (
        pathname.startsWith('/login') ||
        pathname.startsWith('/auth') ||
        pathname.startsWith('/reset-password')
    ) {
        return 'auth';
    }

    // API routes
    if (pathname.startsWith('/api')) {
        return 'api';
    }

    // Default to storefront for all other routes
    return 'storefront';
}
