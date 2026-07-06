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
  email: z.email().optional(),
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
const ShippingItemSchema = z
  .object({
    name: z.string().min(1),
    quantity: z.number().int().positive(),
    weight: z.number().positive(),
    value: z.number().nonnegative(),
    category: z.string().optional(),
    hsCode: z.string().optional(),
    length: z.number().positive().optional(),
    width: z.number().positive().optional(),
    height: z.number().positive().optional(),
  })
  .superRefine((item, ctx) => {
    const dimensionKeys = ['length', 'width', 'height'] as const;
    const providedCount = dimensionKeys.filter(
      (key) => item[key] !== undefined
    ).length;
    if (providedCount === 0 || providedCount === dimensionKeys.length) return;

    for (const key of dimensionKeys) {
      if (item[key] === undefined) {
        ctx.addIssue({
          code: 'custom',
          message: 'Length, width, and height must be provided together',
          path: [key],
        });
      }
    }
  });

// Quote-time requests are allowed to be lighter than booking requests because
// domestic quote calls can be completed with merchant defaults before checkout.
const BaseQuoteAddressSchema = z.object({
  name: z.string().min(1),
  email: z.email().optional(),
  address: z.string().min(1),
  city: z.string().min(1),
  state: z.string().min(1),
  country: z.string().optional(),
  countryCode: z.string().optional(),
  postalCode: z.string().optional(),
  stationId: z.number().optional(),
});

const QuoteReceiverAddressSchema = BaseQuoteAddressSchema.extend({
  phone: z.string().optional(),
});

const QuoteSenderAddressSchema = BaseQuoteAddressSchema.extend({
  phone: z.string().min(1),
});

export const QuoteRequestSchema = z
  .object({
    receiver: QuoteReceiverAddressSchema,
    sender: QuoteSenderAddressSchema.optional(),
    items: z.array(ShippingItemSchema).min(1),
    sessionId: z.string().optional(),
    shipmentType: z.enum(['domestic', 'international']).default('domestic'),
  })
  .superRefine((data, ctx) => {
    if (data.shipmentType !== 'international') return;
    if (!data.receiver.country?.trim()) {
      ctx.addIssue({
        code: 'custom',
        message: 'Receiver country is required for international quotes',
        path: ['receiver', 'country'],
      });
    }
    if (!data.receiver.countryCode?.trim()) {
      ctx.addIssue({
        code: 'custom',
        message: 'Receiver country code is required for international quotes',
        path: ['receiver', 'countryCode'],
      });
    }
  })
  .transform((data) => ({
    ...data,
    receiver: {
      ...data.receiver,
      country: data.receiver.country ?? 'Nigeria',
      countryCode: data.receiver.countryCode ?? 'NG',
    },
    sender: data.sender
      ? {
          ...data.sender,
          country: data.sender.country ?? 'Nigeria',
          countryCode: data.sender.countryCode ?? 'NG',
        }
      : undefined,
  }));

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
    // Dispatch phone number (optional; if provided, must be a full number)
    dispatchPhone: z
      .union([
        z.literal(''),
        z.string().min(10, 'Phone number must be at least 10 digits'),
      ])
      .optional(),
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
      .union([
        z.literal(''),
        z.string().min(10, 'Phone number must be at least 10 digits'),
      ])
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

export type QuoteRequestInput = z.infer<typeof QuoteRequestSchema>;
export type BookingRequestInput = z.infer<typeof BookingRequestSchema>;
export type SelfFulfillmentInput = z.infer<typeof SelfFulfillmentSchema>;
export type SelfFulfillmentUpdateInput = z.infer<
  typeof SelfFulfillmentUpdateSchema
>;
export type LocationsQueryInput = z.infer<typeof locationsQuerySchema>;
