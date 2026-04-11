/**
 * Shipping API Validation Schemas
 * Centralized schemas for shipping-related API routes
 */

import z from 'zod';
import { isValidUuid } from '@/lib/sanitize-core';

/**
 * Address schema for shipping sender/receiver
 */
const AddressSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email().optional(),
  phone: z.string().min(10, 'Phone must be at least 10 digits'),
  address: z.string().min(5, 'Address must be at least 5 characters'),
  city: z.string().min(2, 'City must be at least 2 characters'),
  state: z.string().min(2, 'State must be at least 2 characters'),
  country: z.string().default('Nigeria'),
  countryCode: z.string().default('NG'),
  postalCode: z.string().optional(),
  stationId: z.number().optional(),
});

/**
 * Shipping item schema
 */
const ShippingItemSchema = z.object({
  name: z.string().min(1),
  quantity: z.number().int().positive(),
  weight: z.number().positive(),
  value: z.number().nonnegative(),
  category: z.string().optional(),
});

/**
 * Schema for booking a shipment with a provider
 */
export const BookingRequestSchema = z.object({
  // Order ID (required)
  orderId: z.string().refine(isValidUuid, { message: 'Invalid order ID' }),
  carrierId: z.string().min(1, 'Carrier ID is required'),
  // Selected quote ID (required)
  quoteId: z.string().refine(isValidUuid, { message: 'Invalid quote ID' }),
  // Receiver info (required)
  receiver: AddressSchema,
  // Sender info (optional - uses merchant address)
  sender: AddressSchema.optional(),
  // Items to ship (required)
  items: z.array(ShippingItemSchema).min(1),
  // Special instructions
  instructions: z.string().optional(),
});

/**
 * Schema for self-fulfillment (merchant's own shipping)
 */
export const SelfFulfillmentSchema = z
  .object({
    // Order ID (required)
    orderId: z.string().refine(isValidUuid, { message: 'Invalid order ID' }),
    // Tracking number (optional but recommended)
    trackingNumber: z.string().min(1).optional(),
    // Dispatch phone number (required for self-fulfillment)
    dispatchPhone: z
      .string()
      .min(10, 'Phone number must be at least 10 digits'),
    // Carrier name (optional)
    carrierName: z.string().optional(),
    // Notes for dispatch/rider
    dispatchNotes: z.string().optional(),
  })
  .strict();

export const SelfFulfillmentUpdateSchema = z
  .object({
    orderId: z.string().refine(isValidUuid, { message: 'Invalid order ID' }),
    carrierName: z.string().optional(),
    dispatchNotes: z.string().optional(),
    dispatchPhone: z
      .string()
      .min(10, 'Phone number must be at least 10 digits')
      .optional(),
    trackingNumber: z.string().min(1).optional(),
  })
  .strict();

/**
 * Schema for shipping locations query params
 */
export const locationsQuerySchema = z.object({
  state: z.string().optional(),
  search: z.string().min(2).optional(),
});

export type BookingRequestInput = z.infer<typeof BookingRequestSchema>;
export type SelfFulfillmentInput = z.infer<typeof SelfFulfillmentSchema>;
export type SelfFulfillmentUpdateInput = z.infer<
  typeof SelfFulfillmentUpdateSchema
>;
export type LocationsQueryInput = z.infer<typeof locationsQuerySchema>;
