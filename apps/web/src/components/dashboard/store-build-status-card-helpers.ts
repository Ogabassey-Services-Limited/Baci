import type { StoreBuildStatus } from '@baci/shared';

export interface ApplyResponsePayload {
  error?: string;
  code?: string;
  message?: string;
  lastUpdated?: string | null;
}

export function buildReadinessUrl(merchantId: string) {
  return `/api/merchant/readiness?${new URLSearchParams({ merchantId })}`;
}

export function addPendingMerchant(
  current: ReadonlySet<string>,
  merchantId: string
) {
  return new Set(current).add(merchantId);
}

export function removePendingMerchant(
  current: ReadonlySet<string>,
  merchantId: string
) {
  if (!current.has(merchantId)) return current;
  const next = new Set(current);
  next.delete(merchantId);
  return next;
}

export function isApplyResponsePayload(
  value: unknown
): value is ApplyResponsePayload {
  if (!value || typeof value !== 'object') return false;

  const payload = value as Record<string, unknown>;
  return (
    (payload.error === undefined || typeof payload.error === 'string') &&
    (payload.code === undefined || typeof payload.code === 'string') &&
    (payload.message === undefined || typeof payload.message === 'string') &&
    (payload.lastUpdated === undefined ||
      payload.lastUpdated === null ||
      typeof payload.lastUpdated === 'string')
  );
}

export async function readApplyResponse(response: Response) {
  try {
    const payload: unknown = await response.json();
    return isApplyResponsePayload(payload) ? payload : {};
  } catch {
    return {};
  }
}

export function getFallbackProgress(status: StoreBuildStatus['aiStatus']) {
  switch (status) {
    case 'not_started':
      return 20;
    case 'pending':
      return 45;
    case 'processing':
      return 70;
    case 'ready':
    case 'applied':
    case 'failed':
      return 100;
    default:
      return 0;
  }
}

export function getStatusAccent(status: StoreBuildStatus['aiStatus']) {
  if (status === 'ready') {
    return 'border-sky-200 bg-sky-50/60';
  }

  if (status === 'applied') {
    return 'border-green-200 bg-green-50/60';
  }

  if (status === 'failed') {
    return 'border-amber-200 bg-amber-50/60';
  }

  return 'border-primary/20 bg-primary/5';
}

export function getStatusLabel(status: StoreBuildStatus['aiStatus']) {
  switch (status) {
    case 'pending':
      return 'Store design queued';
    case 'processing':
      return 'Building your store';
    case 'ready':
      return 'AI design ready';
    case 'applied':
      return 'AI design applied';
    case 'failed':
    case 'not_started':
      return 'Starter store ready';
    default:
      return 'Store build status';
  }
}
