import { getMonnifyToken } from '@/lib/monnify';
import { getMonnifyBaseUrl } from '@/lib/monnify-provider-config';
import { createMonnifyHttpError } from './monnify-bills-errors';
import { MONNIFY_DISCOVERY_TIMEOUT_MS } from './monnify-bills-shared';

interface MonnifyRequestOptions extends RequestInit {
  timeoutMs?: number;
}

export async function monnifyRequest<T = unknown>(
  endpoint: string,
  options: MonnifyRequestOptions = {}
): Promise<T> {
  const { timeoutMs = MONNIFY_DISCOVERY_TIMEOUT_MS, ...requestOptions } =
    options;
  const token = await getMonnifyToken();
  const baseUrl = getMonnifyBaseUrl();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const callerSignal = requestOptions.signal;
  const abortFromCaller = () => controller.abort();

  if (callerSignal) {
    if (callerSignal.aborted) {
      abortFromCaller();
    } else {
      callerSignal.addEventListener('abort', abortFromCaller, { once: true });
    }
  }

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    ...(requestOptions.headers || {}),
  };

  try {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      ...requestOptions,
      headers,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw await createMonnifyHttpError(
        response,
        response.status >= 500 ? 'Monnify server error' : 'Monnify API error'
      );
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Monnify request timed out or aborted');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
    callerSignal?.removeEventListener('abort', abortFromCaller);
  }
}
