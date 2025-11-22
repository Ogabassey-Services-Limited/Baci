// Client-side API helper with CSRF protection
// Use this for all API calls that modify data

/**
 * Get CSRF token from cookie
 */
function getCsrfToken(): string | null {
    if (typeof document === 'undefined') return null;

    const cookies = document.cookie.split(';');
    const csrfCookie = cookies.find(c => c.trim().startsWith('csrf-token='));

    if (!csrfCookie) return null;

    return csrfCookie.split('=')[1];
}

/**
 * Fetch with CSRF protection
 * Use this instead of fetch() for all state-changing API calls
 */
export async function fetchWithCsrf(
    url: string,
    options: RequestInit = {}
): Promise<Response> {
    const csrfToken = getCsrfToken();

    // Add CSRF token to headers for state-changing methods
    const method = options.method?.toUpperCase() || 'GET';
    const needsCsrf = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

    const headers = new Headers(options.headers);

    if (needsCsrf && csrfToken) {
        headers.set('x-csrf-token', csrfToken);
    }

    // Always set content-type for JSON requests
    if (options.body && !headers.has('content-type')) {
        headers.set('content-type', 'application/json');
    }

    return fetch(url, {
        ...options,
        headers,
    });
}

/**
 * POST request with CSRF protection
 */
export async function apiPost<T = unknown>(
    url: string,
    data?: unknown
): Promise<T> {
    const response = await fetchWithCsrf(url, {
        method: 'POST',
        body: data ? JSON.stringify(data) : undefined,
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(error.error || error.message || 'Request failed');
    }

    return response.json();
}

/**
 * PUT request with CSRF protection
 */
export async function apiPut<T = unknown>(
    url: string,
    data?: unknown
): Promise<T> {
    const response = await fetchWithCsrf(url, {
        method: 'PUT',
        body: data ? JSON.stringify(data) : undefined,
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(error.error || error.message || 'Request failed');
    }

    return response.json();
}

/**
 * PATCH request with CSRF protection
 */
export async function apiPatch<T = unknown>(
    url: string,
    data?: unknown
): Promise<T> {
    const response = await fetchWithCsrf(url, {
        method: 'PATCH',
        body: data ? JSON.stringify(data) : undefined,
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(error.error || error.message || 'Request failed');
    }

    return response.json();
}

/**
 * DELETE request with CSRF protection
 */
export async function apiDelete<T = unknown>(
    url: string
): Promise<T> {
    const response = await fetchWithCsrf(url, {
        method: 'DELETE',
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(error.error || error.message || 'Request failed');
    }

    return response.json();
}

/**
 * GET request (no CSRF needed but uses same error handling)
 */
export async function apiGet<T = unknown>(
    url: string
): Promise<T> {
    const response = await fetch(url);

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(error.error || error.message || 'Request failed');
    }

    return response.json();
}
