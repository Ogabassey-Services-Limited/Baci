import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api-client';
import type {
  RepairDeviceAdmin,
  RepairQuoteAdmin,
  RepairServiceTypeAdmin,
} from '@/lib/repairs/catalog-admin-mappers';
import type { ImportCommitCounts } from '@/lib/repairs/import-commit';
import type { RepairImportDraftRow } from '@/lib/repairs/import-match';
import type {
  CreateRepairDeviceInput,
  CreateRepairQuoteInput,
  CreateRepairServiceTypeInput,
  RepairImportCommitRow,
  UpdateRepairDeviceInput,
  UpdateRepairQuoteInput,
  UpdateRepairServiceTypeInput,
} from '@/schemas/repair-catalog-admin';

/**
 * Typed browser client for the repairs catalogue dashboard API. Wraps the CSRF
 * aware api-client helpers and unwraps the route payloads.
 */

const BASE = '/api/repairs/catalog';

export interface ProductSearchResult {
  id: string;
  name: string;
  imageUrl: string | null;
}

function firstImage(images: unknown): string | null {
  if (!Array.isArray(images) || images.length === 0) {
    return null;
  }
  const first = images[0];
  if (typeof first === 'string') {
    return first || null;
  }
  if (first && typeof first === 'object' && 'url' in first) {
    const url = (first as { url: unknown }).url;
    return typeof url === 'string' && url.length > 0 ? url : null;
  }
  return null;
}

export async function listServiceTypes(): Promise<RepairServiceTypeAdmin[]> {
  const data = await apiGet<{ serviceTypes: RepairServiceTypeAdmin[] }>(
    `${BASE}/service-types`
  );
  return data.serviceTypes;
}

export async function createServiceType(
  input: CreateRepairServiceTypeInput
): Promise<RepairServiceTypeAdmin> {
  const data = await apiPost<{ serviceType: RepairServiceTypeAdmin }>(
    `${BASE}/service-types`,
    input
  );
  return data.serviceType;
}

export async function updateServiceType(
  id: string,
  input: UpdateRepairServiceTypeInput
): Promise<RepairServiceTypeAdmin> {
  const data = await apiPatch<{ serviceType: RepairServiceTypeAdmin }>(
    `${BASE}/service-types/${id}`,
    input
  );
  return data.serviceType;
}

export function deleteServiceType(id: string): Promise<unknown> {
  return apiDelete(`${BASE}/service-types/${id}`);
}

export async function listDevices(
  query?: string
): Promise<RepairDeviceAdmin[]> {
  const suffix = query ? `?q=${encodeURIComponent(query)}` : '';
  const data = await apiGet<{ devices: RepairDeviceAdmin[] }>(
    `${BASE}/devices${suffix}`
  );
  return data.devices;
}

export async function createDevice(
  input: CreateRepairDeviceInput
): Promise<RepairDeviceAdmin> {
  const data = await apiPost<{ device: RepairDeviceAdmin }>(
    `${BASE}/devices`,
    input
  );
  return data.device;
}

export async function updateDevice(
  id: string,
  input: UpdateRepairDeviceInput
): Promise<RepairDeviceAdmin> {
  const data = await apiPatch<{ device: RepairDeviceAdmin }>(
    `${BASE}/devices/${id}`,
    input
  );
  return data.device;
}

export function deleteDevice(id: string): Promise<unknown> {
  return apiDelete(`${BASE}/devices/${id}`);
}

export async function listQuotes(
  deviceId: string
): Promise<RepairQuoteAdmin[]> {
  const data = await apiGet<{ quotes: RepairQuoteAdmin[] }>(
    `${BASE}/quotes?deviceId=${encodeURIComponent(deviceId)}`
  );
  return data.quotes;
}

export async function createQuote(
  input: CreateRepairQuoteInput
): Promise<RepairQuoteAdmin> {
  const data = await apiPost<{ quote: RepairQuoteAdmin }>(
    `${BASE}/quotes`,
    input
  );
  return data.quote;
}

export async function updateQuote(
  id: string,
  input: UpdateRepairQuoteInput
): Promise<RepairQuoteAdmin> {
  const data = await apiPatch<{ quote: RepairQuoteAdmin }>(
    `${BASE}/quotes/${id}`,
    input
  );
  return data.quote;
}

export function deleteQuote(id: string): Promise<unknown> {
  return apiDelete(`${BASE}/quotes/${id}`);
}

export async function parseImport(
  text: string
): Promise<RepairImportDraftRow[]> {
  const data = await apiPost<{ rows: RepairImportDraftRow[] }>(
    `${BASE}/import/parse`,
    { text }
  );
  return data.rows;
}

export async function commitImport(
  rows: RepairImportCommitRow[]
): Promise<ImportCommitCounts> {
  const data = await apiPost<{ counts: ImportCommitCounts }>(
    `${BASE}/import/commit`,
    { rows }
  );
  return data.counts;
}

export async function searchLinkableProducts(
  query: string
): Promise<ProductSearchResult[]> {
  const data = await apiGet<{
    products: Array<{ id: string; name: string; images?: unknown }>;
  }>(`/api/products?search=${encodeURIComponent(query)}&limit=10`);
  return data.products.map((product) => ({
    id: product.id,
    name: product.name,
    imageUrl: firstImage(product.images),
  }));
}
