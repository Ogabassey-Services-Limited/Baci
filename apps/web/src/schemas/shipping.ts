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
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().min(1),
  address: z.string().min(1),
  city: z.string().min(1),
  state: z.string().min(1),
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
export const SelfFulfillmentSchema = z.object({
  // Order ID (required)
  orderId: z.string().refine(isValidUuid, { message: 'Invalid order ID' }),
  // Tracking number (optional but recommended)
  trackingNumber: z.string().min(1).optional(),
  // Dispatch phone number (required for self-fulfillment)
  dispatchPhone: z.string().min(10, 'Phone number must be at least 10 digits'),
  // Carrier name (optional)
  carrierName: z.string().optional(),
  // Notes for dispatch/rider
  dispatchNotes: z.string().optional(),
});

export type BookingRequestInput = z.infer<typeof BookingRequestSchema>;
export type SelfFulfillmentInput = z.infer<typeof SelfFulfillmentSchema>;
