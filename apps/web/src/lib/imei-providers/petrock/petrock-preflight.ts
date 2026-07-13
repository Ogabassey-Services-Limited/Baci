import 'server-only';

import type { ImeiProviderBinding } from '../types';
import {
  PETROCK_PRODUCT_PRICE_CEILING_MULTIPLIER,
  PETROCK_PRODUCT_SNAPSHOT_MAX_AGE_MS,
} from './petrock.constants';

export interface PetrockProductSnapshot {
  active: boolean;
  currency: string;
  order_field_name: string | null;
  price_usd: number | null;
  product_id: string;
  synced_at: string;
}

type PetrockPreflightFailureCode =
  | 'PROVIDER_CURRENCY_DRIFT'
  | 'PROVIDER_FIELD_DRIFT'
  | 'PROVIDER_PRICE_DRIFT'
  | 'PROVIDER_PRICE_STALE'
  | 'PROVIDER_PRODUCT_UNAVAILABLE';

export type PetrockPreflightResult =
  | { ok: true }
  | { code: PetrockPreflightFailureCode; error: string; ok: false };

export function validatePetrockProductSnapshot({
  binding,
  now,
  snapshot,
}: {
  binding: ImeiProviderBinding;
  now: Date;
  snapshot: PetrockProductSnapshot | null;
}): PetrockPreflightResult {
  if (!snapshot?.active || snapshot.product_id !== binding.productId) {
    return {
      code: 'PROVIDER_PRODUCT_UNAVAILABLE',
      error: 'The selected IMEI provider product is unavailable.',
      ok: false,
    };
  }

  if (snapshot.currency !== 'USD') {
    return {
      code: 'PROVIDER_CURRENCY_DRIFT',
      error: 'The IMEI provider catalog currency changed.',
      ok: false,
    };
  }

  const syncedAt = Date.parse(snapshot.synced_at);
  const snapshotAgeMs = now.getTime() - syncedAt;
  if (
    !Number.isFinite(syncedAt) ||
    snapshotAgeMs < 0 ||
    snapshotAgeMs > PETROCK_PRODUCT_SNAPSHOT_MAX_AGE_MS ||
    snapshot.price_usd === null
  ) {
    return {
      code: 'PROVIDER_PRICE_STALE',
      error: 'The IMEI provider catalog snapshot is stale.',
      ok: false,
    };
  }

  if (snapshot.order_field_name !== binding.orderFieldName) {
    return {
      code: 'PROVIDER_FIELD_DRIFT',
      error: 'The IMEI provider input contract changed.',
      ok: false,
    };
  }

  if (
    snapshot.price_usd >
    binding.costUsd * PETROCK_PRODUCT_PRICE_CEILING_MULTIPLIER
  ) {
    return {
      code: 'PROVIDER_PRICE_DRIFT',
      error: 'The IMEI provider price moved beyond the configured ceiling.',
      ok: false,
    };
  }

  return { ok: true };
}
