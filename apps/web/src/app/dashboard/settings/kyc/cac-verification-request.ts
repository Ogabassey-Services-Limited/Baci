import { fetchWithCsrf } from '@/lib/api-client';

export async function postCacVerificationRequest(url: string, body: BodyInit) {
  const response = await fetchWithCsrf(url, { method: 'POST', body });
  if (response.status === 429) return { kind: 'rate-limited' } as const;
  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: 'Request failed' }));
    return {
      kind: 'error',
      message: typeof error.error === 'string' ? error.error : 'Request failed',
    } as const;
  }
  return { kind: 'success', data: await response.json() } as const;
}
