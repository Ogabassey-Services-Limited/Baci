import { BASE_URL, IS_DEV, resolveBaseUrl } from './api-base-url';
import {
  getResponseErrorMessage,
  isConnectivityError,
  NetworkError,
} from './api-errors';
import { supabase } from './supabase';

export { BASE_URL, NetworkError, resolveBaseUrl };

/** Default request timeout in milliseconds (20 seconds) */
const DEFAULT_TIMEOUT_MS = 20000;

interface RequestOptions extends RequestInit {
  requiresAuth?: boolean;
  /** Request timeout in milliseconds (default: 20000) */
  timeout?: number;
}

/**
 * Standardized API Client wrapper around fetch
 * Automatically handles:
 * - Base URL prepending
 * - Authorization (Bearer token)
 * - JSON Content-Type
 * - Error parsing (handling non-JSON errors gracefully)
 * - Request timeout with AbortController (default 20s)
 * - Network error detection (offline, timeout)
 */
export async function apiClient<T = unknown>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const {
    requiresAuth = true,
    headers = {},
    timeout = DEFAULT_TIMEOUT_MS,
    signal: externalSignal,
    ...customConfig
  } = options;

  // Set up AbortController for timeout handling
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  // If an external signal is provided, abort when it aborts
  if (externalSignal) {
    externalSignal.addEventListener('abort', () => controller.abort());
  }

  const config: RequestInit = {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    signal: controller.signal,
    ...customConfig,
  };

  // Inject Auth Token if required
  if (requiresAuth) {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.access_token) {
      (config.headers as Record<string, string>).Authorization =
        `Bearer ${session.access_token}`;
    }
  }

  // Handle leading slash in endpoint
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${BASE_URL}${cleanEndpoint}`;

  if (IS_DEV) {
    // Use separate arguments to avoid format string injection
    console.log('[API]', config.method, String(url));
  }

  try {
    const response = await fetch(url, config);
    clearTimeout(timeoutId);

    // Check for JSON response
    const contentType = response.headers.get('content-type');
    const isJson = contentType?.includes('application/json');

    // Parse Body
    let data: unknown;
    if (isJson) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      const errorMessage = getResponseErrorMessage(data, response.status);
      throw new NetworkError(errorMessage, {
        statusCode: response.status,
        data,
      });
    }

    return data as T;
  } catch (error: unknown) {
    clearTimeout(timeoutId);

    // Handle AbortError (timeout or manual abort)
    if (error instanceof Error && error.name === 'AbortError') {
      const timeoutError = new NetworkError(
        'Request timed out. Please check your connection and try again.',
        { isTimeout: true }
      );
      // Use separate arguments to avoid format string injection
      console.error('[API Timeout]', String(url));
      throw timeoutError;
    }

    // Re-throw NetworkError (server errors carrying a status) as-is.
    if (error instanceof NetworkError) {
      // Use separate arguments to avoid format string injection
      console.warn('[API Error]', String(url), String(error.message));
      throw error;
    }

    // Handle connection failures (offline, DNS failure, Android ConnectException,
    // connection reset/refused, etc.) — never leak the raw exception string.
    if (isConnectivityError(error)) {
      const offlineError = new NetworkError(
        'Unable to connect. Please check your internet connection.',
        { isOffline: true }
      );
      // Use separate arguments to avoid format string injection
      console.error('[API Offline]', String(url));
      throw offlineError;
    }

    // Handle other errors
    const message = error instanceof Error ? error.message : String(error);
    // Use separate arguments to avoid format string injection
    console.error('[API Error]', String(url), String(message));
    throw error;
  }
}

/**
 * API client for FormData uploads (e.g., file uploads).
 * Unlike apiClient, does NOT set Content-Type — lets the runtime
 * set multipart/form-data with the correct boundary automatically.
 */
export async function apiFormData<T = unknown>(
  endpoint: string,
  formData: FormData,
  options: {
    timeout?: number;
    requiresAuth?: boolean;
    signal?: AbortSignal;
  } = {}
): Promise<T> {
  const {
    timeout = DEFAULT_TIMEOUT_MS,
    requiresAuth = true,
    signal: externalSignal,
  } = options;

  const controller = new AbortController();
  // timeoutId is cleared in the finally block below to cancel the abort timer
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  // Mirror any external signal (e.g. component unmount) into the internal
  // controller so the in-flight fetch is cancelled.
  const onExternalAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener('abort', onExternalAbort);
    }
  }

  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${BASE_URL}${cleanEndpoint}`;

  if (IS_DEV) {
    console.log('[API FormData]', 'POST', String(url));
  }

  try {
    const headers: Record<string, string> = {};
    if (requiresAuth) {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
      signal: controller.signal,
    });

    const contentType = response.headers.get('content-type');
    const isJson = contentType?.includes('application/json');
    const data: unknown = isJson
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      const errorMessage = getResponseErrorMessage(data, response.status);
      throw new NetworkError(errorMessage, {
        statusCode: response.status,
        data,
      });
    }

    return data as T;
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[API FormData Timeout]', String(url));
      throw new NetworkError(
        'Upload timed out. Please check your connection and try again.',
        { isTimeout: true }
      );
    }

    if (error instanceof NetworkError) throw error;

    if (isConnectivityError(error)) {
      console.error('[API FormData Offline]', String(url));
      throw new NetworkError(
        'Unable to connect. Please check your internet connection.',
        { isOffline: true }
      );
    }

    const message = error instanceof Error ? error.message : String(error);
    console.error('[API FormData Error]', String(url), String(message));
    throw error;
  } finally {
    clearTimeout(timeoutId);
    if (externalSignal) {
      externalSignal.removeEventListener('abort', onExternalAbort);
    }
  }
}
