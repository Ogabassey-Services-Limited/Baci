import { supabase } from './supabase';

// Centralized Base URL Logic
export const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'https://usebaci.com';

interface RequestOptions extends RequestInit {
  requiresAuth?: boolean;
}

/**
 * Standardized API Client wrapper around fetch
 * Automatically handles:
 * - Base URL prepending
 * - Authorization (Bearer token)
 * - JSON Content-Type
 * - Error parsing (handling non-JSON errors gracefully)
 */
export async function apiClient<T = unknown>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { requiresAuth = true, headers = {}, ...customConfig } = options;

  const config: RequestInit = {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    ...customConfig,
  };

  // Inject Auth Token if required
  if (requiresAuth) {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.access_token) {
      (config.headers as Record<string, string>)['Authorization'] =
        `Bearer ${session.access_token}`;
    }
  }

  // Handle leading slash in endpoint
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${BASE_URL}${cleanEndpoint}`;

  console.log(`[API] ${config.method} ${url}`);

  try {
    const response = await fetch(url, config);

    // Check for JSON response
    const contentType = response.headers.get('content-type');
    const isJson = contentType && contentType.includes('application/json');

    // Parse Body
    let data;
    if (isJson) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      // Throw standardized error
      const errorMessage =
        (typeof data === 'object' && data.message) ||
        (typeof data === 'object' && data.error) ||
        (typeof data === 'string' && data) ||
        `Request failed with status ${response.status}`;

      throw new Error(errorMessage);
    }

    return data as T;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[API Error] ${url}:`, message);
    throw error;
  }
}
