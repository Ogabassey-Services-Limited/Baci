import { buildDeviceSlug } from './catalog-slug';
import type { ParsedRepairRow } from './import-parse';

/**
 * Pure matching for the AI paste-import review step.
 *
 * Each parsed row is matched against the merchant's existing repair devices
 * (slug / alias / brand+model), products (name/brand) and service types
 * (normalized name), producing a draft row the merchant reviews before commit.
 * All inputs are already tenant-scoped by the caller — no DB access here.
 */

export interface ImportMatchDevice {
  id: string;
  brand: string;
  model: string;
  slug: string;
  aliases: string[];
  productId: string | null;
}

export interface ImportMatchProduct {
  id: string;
  name: string;
  brand: string | null;
}

export interface ImportMatchServiceType {
  id: string;
  name: string;
}

export interface ImportMatchContext {
  devices: ImportMatchDevice[];
  products: ImportMatchProduct[];
  serviceTypes: ImportMatchServiceType[];
}

export type ImportDeviceStatus = 'new_device' | 'existing_device' | 'ambiguous';

export interface RepairImportDraftRow {
  brand: string;
  model: string;
  repairType: string;
  price: number;
  partQuality: string | null;
  status: ImportDeviceStatus;
  deviceId: string | null;
  suggestedProductId: string | null;
  serviceTypeId: string | null;
  newServiceTypeName: string | null;
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function findDeviceCandidates(
  row: ParsedRepairRow,
  devices: ImportMatchDevice[]
): ImportMatchDevice[] {
  const baseSlug = buildDeviceSlug(row.brand, row.model);
  const normModel = normalize(row.model);
  const normBrand = normalize(row.brand);
  const normCombined = normalize(`${row.brand} ${row.model}`);

  const matched = new Map<string, ImportMatchDevice>();
  for (const device of devices) {
    const aliasHit = device.aliases.some((alias) => {
      const normAlias = normalize(alias);
      return normAlias === normModel || normAlias === normCombined;
    });
    const slugHit = device.slug === baseSlug;
    const nameHit =
      normalize(device.brand) === normBrand &&
      normalize(device.model) === normModel;
    if (slugHit || aliasHit || nameHit) {
      matched.set(device.id, device);
    }
  }
  return Array.from(matched.values());
}

function findProductSuggestion(
  row: ParsedRepairRow,
  products: ImportMatchProduct[]
): string | null {
  const normBrand = normalize(row.brand);
  const normModel = normalize(row.model);
  const normCombined = normalize(`${row.brand} ${row.model}`);

  const candidates = products.filter((product) => {
    const normName = normalize(product.name);
    const brandOk =
      normName.includes(normBrand) ||
      (product.brand ? normalize(product.brand) === normBrand : false);
    const modelOk = normName.includes(normModel);
    return normName === normCombined || (brandOk && modelOk);
  });

  const ids = new Set(candidates.map((product) => product.id));
  return ids.size === 1 ? candidates[0].id : null;
}

function findServiceType(
  repairType: string,
  serviceTypes: ImportMatchServiceType[]
): string | null {
  const norm = normalize(repairType);
  const exact = serviceTypes.find((type) => normalize(type.name) === norm);
  if (exact) {
    return exact.id;
  }
  const partial = serviceTypes.filter((type) => {
    const normName = normalize(type.name);
    return normName.includes(norm) || norm.includes(normName);
  });
  return partial.length === 1 ? partial[0].id : null;
}

function matchRow(
  row: ParsedRepairRow,
  context: ImportMatchContext
): RepairImportDraftRow {
  const candidates = findDeviceCandidates(row, context.devices);
  const productSuggestion = findProductSuggestion(row, context.products);
  const serviceTypeId = findServiceType(row.repairType, context.serviceTypes);

  let status: ImportDeviceStatus = 'new_device';
  let deviceId: string | null = null;
  let suggestedProductId: string | null = productSuggestion;

  if (candidates.length === 1) {
    status = 'existing_device';
    deviceId = candidates[0].id;
    suggestedProductId = candidates[0].productId ?? productSuggestion;
  } else if (candidates.length > 1) {
    status = 'ambiguous';
  }

  return {
    brand: row.brand,
    model: row.model,
    repairType: row.repairType,
    price: row.price,
    partQuality: row.partQuality,
    status,
    deviceId,
    suggestedProductId,
    serviceTypeId,
    newServiceTypeName: serviceTypeId ? null : row.repairType.trim(),
  };
}

export function matchImportRows(
  rows: ParsedRepairRow[],
  context: ImportMatchContext
): RepairImportDraftRow[] {
  return rows.map((row) => matchRow(row, context));
}
