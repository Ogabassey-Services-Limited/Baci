import { cacheLife, cacheTag } from 'next/cache';
import {
  type Biller,
  type BillerCategory,
  type BillerProduct,
  billerCategorySchema,
  billerProductSchema,
  billerSchema,
  monnifyEnvelopeSchema,
  monnifyListResponseBodySchema,
} from '@/schemas/monnify-bills-schema';
import { monnifyRequest } from './monnify-bills-request';
import {
  assertMonnifyBusinessSuccess,
  MONNIFY_DISCOVERY_CACHE,
  MONNIFY_DISCOVERY_TIMEOUT_MS,
  type MonnifyDiscoveryOptions,
} from './monnify-bills-shared';

export async function getBillerCategories(
  options: MonnifyDiscoveryOptions = {}
): Promise<BillerCategory[]> {
  const envelope = await monnifyRequest(
    '/api/v1/vas/bills-payment/biller-categories',
    {
      method: 'GET',
      timeoutMs: MONNIFY_DISCOVERY_TIMEOUT_MS,
      signal: options.signal,
    }
  );
  const parsed = monnifyEnvelopeSchema(
    monnifyListResponseBodySchema(billerCategorySchema)
  ).parse(envelope);
  assertMonnifyBusinessSuccess(parsed, 'Monnify biller categories lookup');
  return parsed.responseBody ?? [];
}

export async function getBillers(
  categoryCode: string,
  options: MonnifyDiscoveryOptions = {}
): Promise<Biller[]> {
  const envelope = await monnifyRequest(
    `/api/v1/vas/bills-payment/billers?categoryCode=${encodeURIComponent(categoryCode)}`,
    {
      method: 'GET',
      timeoutMs: MONNIFY_DISCOVERY_TIMEOUT_MS,
      signal: options.signal,
    }
  );
  const parsed = monnifyEnvelopeSchema(
    monnifyListResponseBodySchema(billerSchema)
  ).parse(envelope);
  assertMonnifyBusinessSuccess(parsed, 'Monnify biller lookup');
  return parsed.responseBody ?? [];
}

export async function getBillerProducts(
  billerCode: string,
  options: MonnifyDiscoveryOptions = {}
): Promise<BillerProduct[]> {
  const envelope = await monnifyRequest(
    `/api/v1/vas/bills-payment/biller-products?biller_code=${encodeURIComponent(billerCode)}`,
    {
      method: 'GET',
      timeoutMs: MONNIFY_DISCOVERY_TIMEOUT_MS,
      signal: options.signal,
    }
  );
  const parsed = monnifyEnvelopeSchema(
    monnifyListResponseBodySchema(billerProductSchema)
  ).parse(envelope);
  assertMonnifyBusinessSuccess(parsed, 'Monnify biller products lookup');
  return parsed.responseBody ?? [];
}

export async function getCachedBillers(categoryCode: string) {
  'use cache: remote';
  cacheLife(MONNIFY_DISCOVERY_CACHE);
  cacheTag('monnify-discovery', `monnify-billers-${categoryCode}`);
  return await getBillers(categoryCode);
}

export async function getCachedBillerProducts(billerCode: string) {
  'use cache: remote';
  cacheLife(MONNIFY_DISCOVERY_CACHE);
  cacheTag('monnify-discovery', `monnify-biller-products-${billerCode}`);
  return await getBillerProducts(billerCode);
}
