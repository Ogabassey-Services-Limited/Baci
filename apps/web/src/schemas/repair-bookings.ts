import { z } from 'zod';
import { REPAIR_STATUSES } from '@/lib/repairs/repair-status';

/** Dashboard bookings list filters. */
export const repairBookingsListQuerySchema = z.object({
  status: z.enum(REPAIR_STATUSES).optional(),
  q: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});

export type RepairBookingsListQuery = z.infer<
  typeof repairBookingsListQuerySchema
>;

/**
 * Booking update: advance status and/or edit the estimated cost / admin notes
 * (columns that already existed but were orphaned). At least one field is
 * required. Status transitions are additionally validated server-side against
 * the lifecycle.
 */
export const updateRepairBookingSchema = z
  .object({
    status: z.enum(REPAIR_STATUSES).optional(),
    estimated_cost: z.number().min(0).max(99_999_999).nullable().optional(),
    admin_notes: z.string().trim().max(2000).nullable().optional(),
  })
  .refine(
    (value) =>
      value.status !== undefined ||
      value.estimated_cost !== undefined ||
      value.admin_notes !== undefined,
    { message: 'Provide at least one field to update' }
  );

export type UpdateRepairBookingInput = z.infer<
  typeof updateRepairBookingSchema
>;

/** Courier pickup request: attempt an automatic booking or record a manual one. */
export const repairPickupRequestSchema = z.object({
  mode: z.enum(['auto', 'manual']).default('auto'),
});

export type RepairPickupRequestInput = z.infer<
  typeof repairPickupRequestSchema
>;
