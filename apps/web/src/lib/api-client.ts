// Client-side API helper with CSRF protection
// Use this for all API calls that modify data

import { CSRF_HEADER_NAME, getClientCsrfToken } from '@/lib/csrf';

/**
 * Fetch with CSRF protection
 * Use this instead of fetch() for all state-changing API calls
 */
export function fetchWithCsrf(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const csrfToken = getClientCsrfToken();

  // Add CSRF token to headers for state-changing methods
  const method = options.method?.toUpperCase() || 'GET';
  const needsCsrf = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

  const headers = new Headers(options.headers);

  if (needsCsrf && csrfToken) {
    headers.set(CSRF_HEADER_NAME, csrfToken);
  }

  if (needsCsrf && !csrfToken) {
    console.warn(
      `[CSRF] Missing csrfToken; ${CSRF_HEADER_NAME} header will not be sent. State-changing requests may fail with 403.`
    );
  }

  // Only set application/json when the body is a string. Non-string bodies
  // (FormData, Blob, ArrayBuffer, URLSearchParams, ReadableStream, etc.) are
  // left alone so the browser/runtime can set the correct content-type and
  // multipart boundary automatically.
  if (
    options.body &&
    typeof options.body === 'string' &&
    !headers.has('content-type')
  ) {
    headers.set('content-type', 'application/json');
  }

  return fetch(url, {
    ...options,
    headers,
    credentials: 'include', // Include cookies for authentication
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
    const error = await response
      .json()
      .catch(() => ({ error: 'Request failed' }));
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
    const error = await response
      .json()
      .catch(() => ({ error: 'Request failed' }));
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
    const error = await response
      .json()
      .catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || error.message || 'Request failed');
  }

  return response.json();
}

/**
 * DELETE request with CSRF protection
 */
export async function apiDelete<T = unknown>(url: string): Promise<T> {
  const response = await fetchWithCsrf(url, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || error.message || 'Request failed');
  }

  return response.json();
}

/**
 * GET request (no CSRF needed but uses same error handling)
 */
export async function apiGet<T = unknown>(url: string): Promise<T> {
  const response = await fetch(url, {
    credentials: 'include', // Include cookies for authentication
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || error.message || 'Request failed');
  }

  return response.json();
}
