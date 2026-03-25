/**
 * Jumia Vendor Center API — Order schemas
 */

import { z } from 'zod';
import {
  CountryInfoSchema,
  CurrencyAmountSchema,
  ShippingAddressSchema,
} from '@/schemas/jumia/shared';

// ── Orders ──

const JumiaOrderSchema = z.object({
  id: z.string(),
  shopIds: z.array(z.string()),
  totalItems: z.number(),
  packedItems: z.number(),
  isPrepayment: z.boolean(),
  hasMultipleStatus: z.boolean(),
  hasItemsFulfilledByJumia: z.boolean(),
  pendingSince: z.string().datetime({ offset: true }).optional(),
  status: z.string().min(1),
  deliveryOption: z.string(),
  number: z.string().min(1),
  totalAmount: CurrencyAmountSchema,
  country: CountryInfoSchema,
  shippingAddress: ShippingAddressSchema,
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
  totalAmountLocal: CurrencyAmountSchema,
});

export const JumiaOrdersResponseSchema = z.object({
  orders: z.array(JumiaOrderSchema),
  isLastPage: z.boolean(),
  nextToken: z.string().nullable().optional(),
});

// ── Order Items ──

const JumiaOrderItemSchema = z.object({
  id: z.string(),
  shopId: z.string(),
  product: z.object({
    name: z.string(),
    sellerSku: z.string(),
    imageUrl: z.string().url(),
  }),
  status: z.string().min(1),
  trackingNumber: z.string(),
  // Jumia API returns empty strings for tracking URLs when not yet available
  trackingUrl: z.union([z.string().url(), z.literal('')]).optional(),
  shipmentType: z.string(),
  deliveryOption: z.string(),
  isFulfilledByJumia: z.boolean(),
  itemPrice: z.number(),
  paidPrice: z.number(),
  shippingAmount: z.number(),
  itemPriceLocal: z.number(),
  paidPriceLocal: z.number(),
  shippingAmountLocal: z.number(),
  exchangeRate: z.number(),
  country: CountryInfoSchema,
  taxAmount: z.number(),
  voucherAmount: z.number(),
  shippingAddress: ShippingAddressSchema,
});

export const JumiaOrderItemsResponseSchema = z.object({
  orderId: z.string(),
  orderNumber: z.string(),
  items: z.array(JumiaOrderItemSchema),
});

// ── Shipment Providers ──

export const JumiaShipmentProvidersResponseSchema = z.object({
  orderItems: z.array(
    z.object({
      id: z.string(),
      shipmentProviders: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          requireTrackingCode: z.boolean(),
        })
      ),
    })
  ),
});

// ── Inferred types ──

export type JumiaOrdersResponse = z.infer<typeof JumiaOrdersResponseSchema>;
export type JumiaOrder = z.infer<typeof JumiaOrderSchema>;
export type JumiaOrderItemsResponse = z.infer<
  typeof JumiaOrderItemsResponseSchema
>;
export type JumiaOrderItem = z.infer<typeof JumiaOrderItemSchema>;
export type JumiaShipmentProvidersResponse = z.infer<
  typeof JumiaShipmentProvidersResponseSchema
>;
