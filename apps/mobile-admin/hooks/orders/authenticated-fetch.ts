import { supabase } from '@/lib/supabase';

const TIMEOUT_ERROR_MESSAGE =
  'Request timed out. Please check your connection and try again.';

function mergeAuthorizationHeader(
  headers: HeadersInit | undefined,
  accessToken: string
): HeadersInit {
  if (headers instanceof Headers) {
    const nextHeaders = new Headers(headers);
    nextHeaders.set('Authorization', `Bearer ${accessToken}`);
    return nextHeaders;
  }

  if (Array.isArray(headers)) {
    return [...headers, ['Authorization', `Bearer ${accessToken}`]];
  }

  return {
    ...headers,
    Authorization: `Bearer ${accessToken}`,
  };
}

export async function createAuthenticatedFetch(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw new Error(sessionError.message);
  }

  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }

  const controller = new AbortController();
  const abortFromCaller = () => controller.abort();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  if (options.signal?.aborted) {
    controller.abort();
  } else {
    options.signal?.addEventListener('abort', abortFromCaller, { once: true });
  }

  try {
    return await fetch(url, {
      ...options,
      headers: mergeAuthorizationHeader(options.headers, session.access_token),
      signal: controller.signal,
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(TIMEOUT_ERROR_MESSAGE);
    }

    throw error;
  } finally {
    options.signal?.removeEventListener('abort', abortFromCaller);
    clearTimeout(timeoutId);
  }
}
