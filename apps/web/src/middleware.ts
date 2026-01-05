import { type NextRequest, NextResponse } from 'next/server';
import { checkAuth, updateSession } from '@/lib/supabase/middleware';

export const config = {
    matcher: [
        /*
         * Match all paths except for:
         * 1. /api routes
         * 2. /_next (Next.js internals)
         * 3. /_static (inside /public)
         * 4. all root files inside /public (e.g. /favicon.ico)
         */
        '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};

export default async function middleware(request: NextRequest) {
    const url = request.nextUrl;
    const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'usebaci.com';

    // Get hostname (e.g. vercel.com, test.vercel.app, etc.)
    let hostname = request.headers.get('host')!.replace('.localhost:3000', `.${rootDomain}`);

    // Handle localhost logic for dev
    if (
        hostname.includes('localhost') ||
        hostname.includes('127.0.0.1') ||
        hostname.endsWith('.vercel.app') // Optional: Treat vercel preview URLs as root or tenants?
    ) {
        // For now, keep as is. If accessing via localhost:3000 directly, likely Main App or explicitly tested subdomain
    }

    const searchParams = request.nextUrl.searchParams.toString();
    // Get the pathname of the request (e.g. /, /about, /blog/first-post)
    const path = `${url.pathname}${searchParams.length > 0 ? `?${searchParams}` : ''
        }`;

    // Check if this is the root domain (e.g. usebaci.com)
    const isRootDomain =
        hostname === rootDomain ||
        hostname === `www.${rootDomain}` ||
        hostname === 'localhost:3000'; // Default dev root

    // APP DOMAIN (e.g. usebaci.com)
    if (isRootDomain) {
        // Check auth for protected routes (dashboard, admin, etc.)
        const authResponse = await checkAuth(request);
        if (authResponse) {
            return authResponse;
        }
        // Continue with session update if no redirect
        return (await updateSession(request)).supabaseResponse;
    }

    // CUSTOM DOMAIN / TENANT (e.g. ogabassey.com)
    // Rewrite to /_sites/[site] or in our case /[slug] (as confirmed by layout.tsx)

    // Note: We use the hostname as the slug. 
    // The layout.tsx handles looking up by domain if it looks like a domain.

    // Rewrite traffic to /[hostname]${path}
    return (
        await updateSession(
            request,
            NextResponse.rewrite(new URL(`/${hostname}${path}`, request.url))
        )
    ).supabaseResponse;
}
