import { z } from 'zod';

/**
 * Dashboard catalogue-manager input schemas for the repairs feature.
 *
 * Request/response JSON uses camelCase; the API routes map to the snake_case
 * columns. Every mutation is tenant-scoped in the route layer — these schemas
 * only validate the shape/bounds of caller-supplied fields.
 */

export const REPAIR_DEVICE_TYPES = [
  'Smartphone',
  'Laptop',
  'Tablet',
  'Console',
  'Smartwatch',
  'Other',
] as const;

const deviceTypeSchema = z.enum(REPAIR_DEVICE_TYPES);

const nullableTrimmedString = (max: number) =>
  z.string().trim().max(max).nullable();

const optionalActive = z.boolean().optional().default(true);
const optionalSortOrder = z.number().int().min(0).max(100_000).optional();

// ---------------------------------------------------------------------------
// Service types
// ---------------------------------------------------------------------------

export const createRepairServiceTypeSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  description: nullableTrimmedString(1000).optional(),
  sortOrder: optionalSortOrder,
  isActive: optionalActive,
});

export const updateRepairServiceTypeSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(120),
    description: nullableTrimmedString(1000),
    sortOrder: z.number().int().min(0).max(100_000),
    isActive: z.boolean(),
  })
  .partial();

// z.input (not z.infer/output): defaulted fields (isActive, etc.) stay optional
// for callers — the client payload and the insert builders apply the defaults.
export type CreateRepairServiceTypeInput = z.input<
  typeof createRepairServiceTypeSchema
>;
export type UpdateRepairServiceTypeInput = z.infer<
  typeof updateRepairServiceTypeSchema
>;

// ---------------------------------------------------------------------------
// Devices
// ---------------------------------------------------------------------------

const deviceAliasesSchema = z
  .array(z.string().trim().min(1).max(120))
  .max(50)
  .optional()
  .default([]);

export const createRepairDeviceSchema = z.object({
  brand: z.string().trim().min(1, 'Brand is required').max(120),
  model: z.string().trim().min(1, 'Model is required').max(160),
  deviceType: deviceTypeSchema.nullable().optional(),
  productId: z.uuid().nullable().optional(),
  aliases: deviceAliasesSchema,
  imageUrl: z.url().max(2048).nullable().optional(),
  isActive: optionalActive,
  sortOrder: optionalSortOrder,
});

export const updateRepairDeviceSchema = z
  .object({
    brand: z.string().trim().min(1, 'Brand is required').max(120),
    model: z.string().trim().min(1, 'Model is required').max(160),
    deviceType: deviceTypeSchema.nullable(),
    productId: z.uuid().nullable(),
    aliases: z.array(z.string().trim().min(1).max(120)).max(50),
    imageUrl: z.url().max(2048).nullable(),
    isActive: z.boolean(),
    sortOrder: z.number().int().min(0).max(100_000),
  })
  .partial();

export type CreateRepairDeviceInput = z.input<typeof createRepairDeviceSchema>;
export type UpdateRepairDeviceInput = z.infer<typeof updateRepairDeviceSchema>;

// ---------------------------------------------------------------------------
// Quotes
// ---------------------------------------------------------------------------

const REPAIR_PRICE_MAX = 9_999_999_999.99;
const priceSchema = z
  .number()
  .min(0, 'Price must be zero or more')
  .max(REPAIR_PRICE_MAX);
const warrantyDaysSchema = z.number().int().min(0).max(3650).nullable();

export const createRepairQuoteSchema = z.object({
  deviceId: z.uuid(),
  serviceTypeId: z.uuid(),
  price: priceSchema,
  isFromPrice: z.boolean().optional().default(true),
  partQuality: nullableTrimmedString(120).optional(),
  turnaround: nullableTrimmedString(120).optional(),
  warrantyDays: warrantyDaysSchema.optional(),
  description: nullableTrimmedString(1000).optional(),
  internalNotes: nullableTrimmedString(2000).optional(),
  isActive: optionalActive,
});

export const updateRepairQuoteSchema = z
  .object({
    serviceTypeId: z.uuid(),
    price: priceSchema,
    isFromPrice: z.boolean(),
    partQuality: nullableTrimmedString(120),
    turnaround: nullableTrimmedString(120),
    warrantyDays: warrantyDaysSchema,
    description: nullableTrimmedString(1000),
    internalNotes: nullableTrimmedString(2000),
    isActive: z.boolean(),
  })
  .partial();

export type CreateRepairQuoteInput = z.input<typeof createRepairQuoteSchema>;
export type UpdateRepairQuoteInput = z.infer<typeof updateRepairQuoteSchema>;

// ---------------------------------------------------------------------------
// AI paste-import
// ---------------------------------------------------------------------------

export const REPAIR_IMPORT_TEXT_MAX = 20_000;

export const repairImportParseSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, 'Paste a price list')
    .max(REPAIR_IMPORT_TEXT_MAX),
});

export type RepairImportParseInput = z.infer<typeof repairImportParseSchema>;

export const repairImportCommitRowSchema = z.object({
  brand: z.string().trim().min(1).max(120),
  model: z.string().trim().min(1).max(160),
  repairType: z.string().trim().min(1, 'Repair type is required').max(120),
  price: priceSchema,
  partQuality: nullableTrimmedString(120).optional(),
  isFromPrice: z.boolean().optional().default(true),
  deviceType: deviceTypeSchema.nullable().optional(),
  deviceId: z.uuid().nullable().optional(),
  serviceTypeId: z.uuid().nullable().optional(),
  productId: z.uuid().nullable().optional(),
});

export type RepairImportCommitRow = z.input<typeof repairImportCommitRowSchema>;

export const repairImportCommitSchema = z.object({
  rows: z
    .array(repairImportCommitRowSchema)
    .min(1, 'No rows to commit')
    .max(500),
});

export type RepairImportCommitInput = z.infer<typeof repairImportCommitSchema>;
