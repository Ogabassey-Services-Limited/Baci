// CSRF Protection Utilities
// Implements Double Submit Cookie pattern for CSRF protection

import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const CSRF_TOKEN_NAME = 'csrf-token';
const CSRF_HEADER_NAME = 'x-csrf-token';
const CSRF_SECRET_NAME = 'csrf-secret';

/**
 * Generate a cryptographically secure CSRF token
 */
export function generateCsrfToken(): string {
    return crypto.randomBytes(32).toString('base64url');
}

/**
 * Create CSRF token pair (token + secret)
 */
export function createCsrfTokenPair(): { token: string; secret: string } {
    const token = generateCsrfToken();
    const secret = generateCsrfToken();

    return { token, secret };
}

/**
 * Hash token with secret for verification
 */
function hashToken(token: string, secret: string): string {
    return crypto
        .createHmac('sha256', secret)
        .update(token)
        .digest('base64url');
}

/**
 * Set CSRF token in cookies (call this in server components/API routes)
 */
export async function setCsrfToken(): Promise<string> {
    const cookieStore = await cookies();
    const { token, secret } = createCsrfTokenPair();

    // Store secret in httpOnly cookie
    cookieStore.set(CSRF_SECRET_NAME, secret, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24, // 24 hours
    });

    // Store token in regular cookie (accessible to JavaScript)
    cookieStore.set(CSRF_TOKEN_NAME, token, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24, // 24 hours
    });

    return token;
}

/**
 * Get CSRF token from cookies (for client-side use)
 */
export async function getCsrfToken(): Promise<string | null> {
    const cookieStore = await cookies();
    const token = cookieStore.get(CSRF_TOKEN_NAME);

    if (!token) {
        // Generate new token if none exists
        return await setCsrfToken();
    }

    return token.value;
}

/**
 * Verify CSRF token from request
 */
export async function verifyCsrfToken(request: NextRequest): Promise<boolean> {
    // Get token from header
    const headerToken = request.headers.get(CSRF_HEADER_NAME);

    if (!headerToken) {
        console.warn('CSRF: No token in header');
        return false;
    }

    // Get secret from cookie
    const cookieStore = await cookies();
    const secretCookie = cookieStore.get(CSRF_SECRET_NAME);
    const tokenCookie = cookieStore.get(CSRF_TOKEN_NAME);

    if (!secretCookie || !tokenCookie) {
        console.warn('CSRF: Missing cookies');
        return false;
    }

    // Verify token matches
    if (headerToken !== tokenCookie.value) {
        console.warn('CSRF: Token mismatch');
        return false;
    }

    // Additional verification: hash check
    const expectedHash = hashToken(tokenCookie.value, secretCookie.value);
    const actualHash = hashToken(headerToken, secretCookie.value);

    return expectedHash === actualHash;
}

/**
 * Middleware to check CSRF token for state-changing requests
 */
export async function checkCsrfProtection(request: NextRequest): Promise<{
    valid: boolean;
    response?: NextResponse;
}> {
    const method = request.method;

    // Only check CSRF for state-changing methods
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        return { valid: true };
    }

    // Skip CSRF check for certain endpoints (e.g., webhooks)
    const pathname = request.nextUrl.pathname;
    const skipPaths = ['/api/webhooks/', '/api/auth/'];

    if (skipPaths.some(path => pathname.startsWith(path))) {
        return { valid: true };
    }

    // Verify CSRF token
    const isValid = await verifyCsrfToken(request);

    if (!isValid) {
        const response = NextResponse.json(
            {
                error: 'Invalid CSRF token',
                message: 'CSRF token validation failed. Please refresh the page and try again.',
            },
            { status: 403 }
        );

        return { valid: false, response };
    }

    return { valid: true };
}

/**
 * Client-side helper to get CSRF token from cookie
 */
export function getClientCsrfToken(): string | null {
    if (typeof document === 'undefined') return null;

    const cookies = document.cookie.split(';');
    const csrfCookie = cookies.find(c => c.trim().startsWith(`${CSRF_TOKEN_NAME}=`));

    if (!csrfCookie) return null;

    return csrfCookie.split('=')[1];
}
