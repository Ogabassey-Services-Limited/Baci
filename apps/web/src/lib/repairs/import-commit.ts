import type { RepairImportCommitRow } from '@/schemas/repair-catalog-admin';
import {
  buildDeviceSlug,
  nextAvailableSlug,
  slugifyRepair,
} from './catalog-slug';

/**
 * Idempotent commit of reviewed AI-import rows into the catalogue.
 *
 * The algorithm is decoupled from Supabase via ImportCommitRepository so it can
 * be unit-tested against a fake. The repository implementation scopes every
 * query to the merchant; the algorithm only decides create-vs-update. Re-running
 * the same rows updates prices instead of duplicating rows.
 */

export interface ImportCommitServiceType {
  id: string;
  name: string;
  slug: string;
}

export interface ImportCommitDevice {
  id: string;
  brand: string;
  model: string;
  slug: string;
  aliases: string[];
  productId: string | null;
}

export interface ImportCommitRepository {
  listServiceTypes(): Promise<ImportCommitServiceType[]>;
  listDevices(): Promise<ImportCommitDevice[]>;
  createServiceType(input: {
    name: string;
    slug: string;
  }): Promise<{ id: string }>;
  createDevice(input: {
    brand: string;
    model: string;
    slug: string;
    deviceType: string | null;
    productId: string | null;
    aliases: string[];
  }): Promise<{ id: string }>;
  findQuote(
    deviceId: string,
    serviceTypeId: string,
    partQuality: string | null
  ): Promise<{ id: string } | null>;
  updateQuotePrice(
    id: string,
    price: number,
    isFromPrice: boolean
  ): Promise<void>;
  createQuote(input: {
    deviceId: string;
    serviceTypeId: string;
    partQuality: string | null;
    price: number;
    isFromPrice: boolean;
  }): Promise<void>;
}

export interface ImportCommitCounts {
  serviceTypesCreated: number;
  devicesCreated: number;
  quotesCreated: number;
  quotesUpdated: number;
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

interface DeviceIndex {
  byId: Map<string, ImportCommitDevice>;
  byName: Map<string, string>;
  slugs: Set<string>;
}

function indexDevices(devices: ImportCommitDevice[]): DeviceIndex {
  const index: DeviceIndex = {
    byId: new Map(),
    byName: new Map(),
    slugs: new Set(),
  };
  for (const device of devices) {
    index.byId.set(device.id, device);
    index.byName.set(normalize(`${device.brand} ${device.model}`), device.id);
    index.slugs.add(device.slug);
  }
  return index;
}

async function resolveServiceType(
  row: RepairImportCommitRow,
  repo: ImportCommitRepository,
  byName: Map<string, string>,
  slugs: Set<string>,
  counts: ImportCommitCounts
): Promise<string> {
  if (row.serviceTypeId) {
    return row.serviceTypeId;
  }
  const key = normalize(row.repairType);
  const existing = byName.get(key);
  if (existing) {
    return existing;
  }
  const slug = nextAvailableSlug(slugifyRepair(row.repairType), slugs);
  const created = await repo.createServiceType({
    name: row.repairType.trim(),
    slug,
  });
  byName.set(key, created.id);
  slugs.add(slug);
  counts.serviceTypesCreated += 1;
  return created.id;
}

async function resolveDevice(
  row: RepairImportCommitRow,
  repo: ImportCommitRepository,
  index: DeviceIndex,
  counts: ImportCommitCounts
): Promise<string> {
  if (row.deviceId && index.byId.has(row.deviceId)) {
    return row.deviceId;
  }
  // Match on normalized brand+model (not slug: slugs go stale after a rename).
  const nameKey = normalize(`${row.brand} ${row.model}`);
  const byName = index.byName.get(nameKey);
  if (byName) {
    return byName;
  }

  const slug = nextAvailableSlug(
    buildDeviceSlug(row.brand, row.model),
    index.slugs
  );
  const created = await repo.createDevice({
    brand: row.brand.trim(),
    model: row.model.trim(),
    slug,
    deviceType: row.deviceType ?? null,
    productId: row.productId ?? null,
    aliases: [],
  });
  index.slugs.add(slug);
  index.byName.set(nameKey, created.id);
  index.byId.set(created.id, {
    id: created.id,
    brand: row.brand,
    model: row.model,
    slug,
    aliases: [],
    productId: row.productId ?? null,
  });
  counts.devicesCreated += 1;
  return created.id;
}

async function upsertQuote(
  row: RepairImportCommitRow,
  deviceId: string,
  serviceTypeId: string,
  repo: ImportCommitRepository,
  counts: ImportCommitCounts
): Promise<void> {
  const partQuality = row.partQuality ?? null;
  const isFromPrice = row.isFromPrice ?? true;
  const existing = await repo.findQuote(deviceId, serviceTypeId, partQuality);
  if (existing) {
    await repo.updateQuotePrice(existing.id, row.price, isFromPrice);
    counts.quotesUpdated += 1;
    return;
  }
  await repo.createQuote({
    deviceId,
    serviceTypeId,
    partQuality,
    price: row.price,
    isFromPrice,
  });
  counts.quotesCreated += 1;
}

export async function commitImportRows(
  rows: RepairImportCommitRow[],
  repo: ImportCommitRepository
): Promise<ImportCommitCounts> {
  const counts: ImportCommitCounts = {
    serviceTypesCreated: 0,
    devicesCreated: 0,
    quotesCreated: 0,
    quotesUpdated: 0,
  };

  const serviceTypes = await repo.listServiceTypes();
  const serviceTypeByName = new Map<string, string>();
  const serviceTypeSlugs = new Set<string>();
  for (const type of serviceTypes) {
    serviceTypeByName.set(normalize(type.name), type.id);
    serviceTypeSlugs.add(type.slug);
  }

  const deviceIndex = indexDevices(await repo.listDevices());

  for (const row of rows) {
    const serviceTypeId = await resolveServiceType(
      row,
      repo,
      serviceTypeByName,
      serviceTypeSlugs,
      counts
    );
    const deviceId = await resolveDevice(row, repo, deviceIndex, counts);
    await upsertQuote(row, deviceId, serviceTypeId, repo, counts);
  }

  return counts;
}
