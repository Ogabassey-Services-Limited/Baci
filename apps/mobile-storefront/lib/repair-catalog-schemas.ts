import type {
  RepairBookingResult,
  RepairDeviceBrandGroup,
  RepairDeviceDetail,
  RepairDeviceSummary,
  RepairDevicesResponse,
  RepairLinkedProductSummary,
  RepairProductKeySpec,
  RepairQuoteSummary,
} from '@baci/shared/repairs';
import { z } from 'zod';

/**
 * Runtime validation for the repairs catalogue read/write APIs
 * (`GET /api/storefront/[slug]/repairs/devices`,
 * `GET /api/storefront/[slug]/repairs/devices/[deviceSlug]`,
 * `POST /api/storefront/[slug]/repairs/book`). Local to the mobile app (not
 * `packages/shared`) — the shared package only exports the plain display
 * types these schemas are checked against via `satisfies`, so a shape drift
 * between the two is a compile error here rather than a silent runtime bug.
 */

const RepairDeviceTypeSchema = z.enum([
  'Smartphone',
  'Laptop',
  'Tablet',
  'Console',
  'Smartwatch',
  'Other',
]);

export const RepairDeviceSummarySchema = z.object({
  id: z.string(),
  brand: z.string(),
  model: z.string(),
  slug: z.string(),
  deviceType: RepairDeviceTypeSchema.nullable(),
  imageUrl: z.string().nullable(),
  productId: z.string().nullable(),
}) satisfies z.ZodType<RepairDeviceSummary>;

export const RepairDeviceBrandGroupSchema = z.object({
  brand: z.string(),
  devices: z.array(RepairDeviceSummarySchema),
}) satisfies z.ZodType<RepairDeviceBrandGroup>;

export const RepairDevicesResponseSchema = z.object({
  groups: z.array(RepairDeviceBrandGroupSchema),
}) satisfies z.ZodType<RepairDevicesResponse>;

export const RepairQuoteSummarySchema = z.object({
  id: z.string(),
  serviceTypeId: z.string(),
  serviceTypeName: z.string(),
  price: z.number(),
  isFromPrice: z.boolean(),
  partQuality: z.string().nullable(),
  turnaround: z.string().nullable(),
  warrantyDays: z.number().nullable(),
  description: z.string().nullable(),
}) satisfies z.ZodType<RepairQuoteSummary>;

const RepairProductKeySpecSchema = z.object({
  label: z.string(),
  value: z.string(),
}) satisfies z.ZodType<RepairProductKeySpec>;

const RepairLinkedProductSummarySchema = z.object({
  id: z.string(),
  slug: z.string().nullable(),
  name: z.string().nullable(),
  imageUrl: z.string().nullable(),
  keySpecs: z.array(RepairProductKeySpecSchema),
}) satisfies z.ZodType<RepairLinkedProductSummary>;

export const RepairDeviceDetailSchema = z.object({
  device: RepairDeviceSummarySchema,
  quotes: z.array(RepairQuoteSummarySchema),
  product: RepairLinkedProductSummarySchema.nullable(),
}) satisfies z.ZodType<RepairDeviceDetail>;

export const RepairBookingResultSchema = z.object({
  id: z.string(),
  ticketNumber: z.number(),
}) satisfies z.ZodType<RepairBookingResult>;

/**
 * Client-authored booking request body. Field names mirror the web
 * `repairBookingSchema` (`apps/web/src/lib/validations/repair.ts`) exactly —
 * the mobile route reuses that same schema server-side, so this is a
 * client-side pre-check only (catches obvious mistakes before a round trip,
 * never a substitute for the server's validation).
 */
export const RepairBookingRequestSchema = z
  .object({
    customerName: z.string().min(2).max(100),
    customerEmail: z.email(),
    customerPhone: z
      .string()
      .min(10)
      .regex(/^[+]?[\d\s-]{10,}$/),
    deviceType: RepairDeviceTypeSchema,
    deviceModel: z.string().min(2),
    issueDescription: z.string().min(10),
    preferredDate: z.string().optional(),
    serviceType: z.enum(['dropoff', 'pickup']),
    pickupAddress: z.string().optional(),
    deviceId: z.string().optional(),
    quoteId: z.string().optional(),
  })
  .refine(
    (data) =>
      data.serviceType !== 'pickup' ||
      (data.pickupAddress && data.pickupAddress.length >= 5),
    { message: 'Please enter a valid pickup address', path: ['pickupAddress'] }
  );

export type RepairBookingRequest = z.infer<typeof RepairBookingRequestSchema>;
