import {
  REPAIR_DEVICE_TYPES,
  type RepairDeviceType,
} from '@baci/shared/repairs';
import type {
  CreateRepairDeviceInput,
  CreateRepairQuoteInput,
  CreateRepairServiceTypeInput,
  UpdateRepairDeviceInput,
  UpdateRepairQuoteInput,
  UpdateRepairServiceTypeInput,
} from '@/schemas/repair-catalog-admin';

/**
 * Row mappers and payload builders for the repairs catalogue dashboard.
 *
 * Response JSON is camelCase; DB columns are snake_case. Update builders only
 * emit the keys the caller actually provided so PATCH stays a partial update.
 */

export const SERVICE_TYPE_COLUMNS =
  'id, merchant_id, name, slug, description, sort_order, is_active, created_at, updated_at';
export const DEVICE_COLUMNS =
  'id, merchant_id, brand, model, slug, device_type, product_id, aliases, image_url, is_active, sort_order, created_at, updated_at';
// Dashboard quote reads include internal_notes (service-role client only).
export const QUOTE_ADMIN_COLUMNS =
  'id, merchant_id, device_id, service_type_id, price, is_from_price, part_quality, turnaround, warranty_days, description, internal_notes, is_active, created_at, updated_at';

type Row = Record<string, unknown>;

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asNumber(value: unknown): number {
  if (typeof value === 'number') {
    return value;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function asNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

function asDeviceType(value: unknown): RepairDeviceType | null {
  return typeof value === 'string' &&
    (REPAIR_DEVICE_TYPES as readonly string[]).includes(value)
    ? (value as RepairDeviceType)
    : null;
}

function asAliases(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];
}

export interface RepairServiceTypeAdmin {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RepairDeviceAdmin {
  id: string;
  brand: string;
  model: string;
  slug: string;
  deviceType: RepairDeviceType | null;
  productId: string | null;
  aliases: string[];
  imageUrl: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface RepairQuoteAdmin {
  id: string;
  deviceId: string;
  serviceTypeId: string;
  price: number;
  isFromPrice: boolean;
  partQuality: string | null;
  turnaround: string | null;
  warrantyDays: number | null;
  description: string | null;
  internalNotes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export function mapServiceTypeRow(row: Row): RepairServiceTypeAdmin {
  return {
    id: asString(row.id),
    name: asString(row.name),
    slug: asString(row.slug),
    description: asNullableString(row.description),
    sortOrder: asNumber(row.sort_order),
    isActive: asBoolean(row.is_active),
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
  };
}

export function mapDeviceRow(row: Row): RepairDeviceAdmin {
  return {
    id: asString(row.id),
    brand: asString(row.brand),
    model: asString(row.model),
    slug: asString(row.slug),
    deviceType: asDeviceType(row.device_type),
    productId: asNullableString(row.product_id),
    aliases: asAliases(row.aliases),
    imageUrl: asNullableString(row.image_url),
    isActive: asBoolean(row.is_active),
    sortOrder: asNumber(row.sort_order),
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
  };
}

export function mapQuoteRow(row: Row): RepairQuoteAdmin {
  return {
    id: asString(row.id),
    deviceId: asString(row.device_id),
    serviceTypeId: asString(row.service_type_id),
    price: asNumber(row.price),
    isFromPrice: asBoolean(row.is_from_price),
    partQuality: asNullableString(row.part_quality),
    turnaround: asNullableString(row.turnaround),
    warrantyDays: asNullableNumber(row.warranty_days),
    description: asNullableString(row.description),
    internalNotes: asNullableString(row.internal_notes),
    isActive: asBoolean(row.is_active),
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
  };
}

function setIfDefined<T>(target: Row, key: string, value: T | undefined): void {
  if (value !== undefined) {
    target[key] = value;
  }
}

export function buildServiceTypeInsert(
  input: CreateRepairServiceTypeInput,
  merchantId: string,
  slug: string
): Row {
  return {
    merchant_id: merchantId,
    name: input.name,
    slug,
    description: input.description ?? null,
    sort_order: input.sortOrder ?? 0,
    is_active: input.isActive ?? true,
  };
}

export function buildServiceTypeUpdate(
  input: UpdateRepairServiceTypeInput
): Row {
  const payload: Row = {};
  setIfDefined(payload, 'name', input.name);
  setIfDefined(payload, 'description', input.description);
  setIfDefined(payload, 'sort_order', input.sortOrder);
  setIfDefined(payload, 'is_active', input.isActive);
  return payload;
}

export function buildDeviceInsert(
  input: CreateRepairDeviceInput,
  merchantId: string,
  slug: string
): Row {
  return {
    merchant_id: merchantId,
    brand: input.brand,
    model: input.model,
    slug,
    device_type: input.deviceType ?? null,
    product_id: input.productId ?? null,
    aliases: input.aliases ?? [],
    image_url: input.imageUrl ?? null,
    is_active: input.isActive ?? true,
    sort_order: input.sortOrder ?? 0,
  };
}

export function buildDeviceUpdate(input: UpdateRepairDeviceInput): Row {
  const payload: Row = {};
  setIfDefined(payload, 'brand', input.brand);
  setIfDefined(payload, 'model', input.model);
  setIfDefined(payload, 'device_type', input.deviceType);
  setIfDefined(payload, 'product_id', input.productId);
  setIfDefined(payload, 'aliases', input.aliases);
  setIfDefined(payload, 'image_url', input.imageUrl);
  setIfDefined(payload, 'is_active', input.isActive);
  setIfDefined(payload, 'sort_order', input.sortOrder);
  return payload;
}

export function buildQuoteInsert(
  input: CreateRepairQuoteInput,
  merchantId: string
): Row {
  return {
    merchant_id: merchantId,
    device_id: input.deviceId,
    service_type_id: input.serviceTypeId,
    price: input.price,
    is_from_price: input.isFromPrice ?? true,
    part_quality: input.partQuality ?? null,
    turnaround: input.turnaround ?? null,
    warranty_days: input.warrantyDays ?? null,
    description: input.description ?? null,
    internal_notes: input.internalNotes ?? null,
    is_active: input.isActive ?? true,
  };
}

export function buildQuoteUpdate(input: UpdateRepairQuoteInput): Row {
  const payload: Row = {};
  setIfDefined(payload, 'service_type_id', input.serviceTypeId);
  setIfDefined(payload, 'price', input.price);
  setIfDefined(payload, 'is_from_price', input.isFromPrice);
  setIfDefined(payload, 'part_quality', input.partQuality);
  setIfDefined(payload, 'turnaround', input.turnaround);
  setIfDefined(payload, 'warranty_days', input.warrantyDays);
  setIfDefined(payload, 'description', input.description);
  setIfDefined(payload, 'internal_notes', input.internalNotes);
  setIfDefined(payload, 'is_active', input.isActive);
  return payload;
}
