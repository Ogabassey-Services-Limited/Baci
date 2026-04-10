import Constants from 'expo-constants';
import { supabase } from './supabase';

const IS_DEV =
  typeof __DEV__ !== 'undefined'
    ? __DEV__
    : process.env.NODE_ENV !== 'production';

function getHostFromHostUri(hostUri: string): string {
  const trimmedHostUri = hostUri.trim().split('/')[0] || hostUri.trim();
  const bracketedIpv6Match = trimmedHostUri.match(/^\[([^\]]+)\](?::\d+)?$/);
  if (bracketedIpv6Match) {
    return bracketedIpv6Match[1];
  }

  const simpleHostMatch = trimmedHostUri.match(/^([^:]+)(?::\d+)?$/);
  if (simpleHostMatch) {
    return simpleHostMatch[1];
  }

  const lastColonIndex = trimmedHostUri.lastIndexOf(':');
  if (lastColonIndex > -1) {
    const portCandidate = trimmedHostUri.slice(lastColonIndex + 1);
    if (/^\d+$/.test(portCandidate)) {
      return trimmedHostUri.slice(0, lastColonIndex);
    }
  }

  return trimmedHostUri;
}

function formatBaseUrlHost(host: string): string {
  return host.includes(':') && !host.startsWith('[') ? `[${host}]` : host;
}

const DEFAULT_PRODUCTION_URL = 'https://usebaci.com';

// Centralized Base URL Logic
// In dev, auto-detect the IP from Expo's debuggerHost so it works
// regardless of which network the laptop is on (no more hardcoding IPs).
export function resolveBaseUrl(
  options: {
    isDev?: boolean;
    configuredBaseUrl?: string;
    fallbackConfiguredBaseUrl?: string;
    hostUri?: string;
  } = {}
): string {
  const {
    isDev = IS_DEV,
    configuredBaseUrl = process.env.EXPO_PUBLIC_API_URL,
    fallbackConfiguredBaseUrl = process.env.EXPO_PUBLIC_WEB_API_URL,
    hostUri = Constants.expoConfig?.hostUri,
  } = options;

  if (isDev) {
    // Prefer explicit API URL (strip trailing slash)
    if (configuredBaseUrl) return configuredBaseUrl.replace(/\/+$/, '');
    if (fallbackConfiguredBaseUrl)
      return fallbackConfiguredBaseUrl.replace(/\/+$/, '');
    // Auto-detect from Expo debugger host
    if (hostUri) {
      const host = getHostFromHostUri(hostUri);
      return `http://${formatBaseUrlHost(host)}:3000`;
    }
    return 'http://localhost:3000';
  }

  return (configuredBaseUrl || DEFAULT_PRODUCTION_URL).replace(/\/+$/, '');
}

export const BASE_URL = resolveBaseUrl();

/** Default request timeout in milliseconds (20 seconds) */
const DEFAULT_TIMEOUT_MS = 20000;

interface RequestOptions extends RequestInit {
  requiresAuth?: boolean;
  /** Request timeout in milliseconds (default: 20000) */
  timeout?: number;
}

/** Custom error class for network-related errors */
export class NetworkError extends Error {
  public readonly isTimeout: boolean;
  public readonly isOffline: boolean;
  public readonly statusCode?: number;

  constructor(
    message: string,
    options: {
      isTimeout?: boolean;
      isOffline?: boolean;
      statusCode?: number;
    } = {}
  ) {
    super(message);
    this.name = 'NetworkError';
    this.isTimeout = options.isTimeout ?? false;
    this.isOffline = options.isOffline ?? false;
    this.statusCode = options.statusCode;
  }
}

function getResponseErrorMessage(data: unknown, status: number): string {
  if (typeof data === 'string' && data) {
    return data;
  }

  if (data && typeof data === 'object') {
    if ('message' in data && typeof data.message === 'string') {
      return data.message;
    }

    if ('error' in data && typeof data.error === 'string') {
      return data.error;
    }
  }

  return `Request failed with status ${status}`;
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
      throw new NetworkError(errorMessage, { statusCode: response.status });
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

    // Handle network errors (offline, DNS failure, etc.)
    if (
      error instanceof TypeError &&
      error.message === 'Network request failed'
    ) {
      const offlineError = new NetworkError(
        'Unable to connect. Please check your internet connection.',
        { isOffline: true }
      );
      // Use separate arguments to avoid format string injection
      console.error('[API Offline]', String(url));
      throw offlineError;
    }

    // Re-throw NetworkError as-is
    if (error instanceof NetworkError) {
      // Use separate arguments to avoid format string injection
      console.error('[API Error]', String(url), String(error.message));
      throw error;
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
  options: { timeout?: number; requiresAuth?: boolean } = {}
): Promise<T> {
  const { timeout = DEFAULT_TIMEOUT_MS, requiresAuth = true } = options;

  const controller = new AbortController();
  // timeoutId is cleared in the finally block below to cancel the abort timer
  const timeoutId = setTimeout(() => controller.abort(), timeout);

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
      throw new NetworkError(errorMessage, { statusCode: response.status });
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

    if (
      error instanceof TypeError &&
      error.message === 'Network request failed'
    ) {
      console.error('[API FormData Offline]', String(url));
      throw new NetworkError(
        'Unable to connect. Please check your internet connection.',
        { isOffline: true }
      );
    }

    if (error instanceof NetworkError) throw error;

    const message = error instanceof Error ? error.message : String(error);
    console.error('[API FormData Error]', String(url), String(message));
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
