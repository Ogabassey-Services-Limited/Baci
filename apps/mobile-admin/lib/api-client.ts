import Constants from 'expo-constants';
import { supabase } from './supabase';

// Centralized Base URL Logic
// In dev, auto-detect the IP from Expo's debuggerHost so it works
// regardless of which network the laptop is on (no more hardcoding IPs).
function getDevBaseUrl(): string {
  const debuggerHost = Constants.expoConfig?.hostUri;
  if (debuggerHost) {
    const host = debuggerHost.split(':')[0];
    return `http://${host}:3000`;
  }
  return 'http://localhost:3000';
}

export const BASE_URL = __DEV__
  ? getDevBaseUrl()
  : process.env.EXPO_PUBLIC_API_URL || 'https://usebaci.com';

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
  public readonly code?: string;

  constructor(
    message: string,
    options: {
      isTimeout?: boolean;
      isOffline?: boolean;
      statusCode?: number;
      code?: string;
    } = {}
  ) {
    super(message);
    this.name = 'NetworkError';
    this.isTimeout = options.isTimeout ?? false;
    this.isOffline = options.isOffline ?? false;
    this.statusCode = options.statusCode;
    this.code = options.code;
  }
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

  if (__DEV__) {
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
    let data;
    if (isJson) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      // Throw standardized error with status code
      const errorMessage =
        (typeof data === 'object' && data.message) ||
        (typeof data === 'object' && data.error) ||
        (typeof data === 'string' && data) ||
        `Request failed with status ${response.status}`;
      const errorCode =
        typeof data === 'object' &&
        data !== null &&
        typeof data.code === 'string'
          ? data.code
          : undefined;

      throw new NetworkError(errorMessage, {
        statusCode: response.status,
        code: errorCode,
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
