import { z } from 'zod';
import { NetworkProvider } from '@/lib/kuda';

export const billTypeEnum = z.enum([
  'airtime',
  'data',
  'electricity',
  'cable_tv',
  'betting',
]);
export type BillType = z.infer<typeof billTypeEnum>;

export const purchaseSchema = z
  .object({
    merchantSlug: z.string().min(1),
    amount: z.number().min(50).max(500000),
    type: billTypeEnum,
    // Airtime/Data fields
    phoneNumber: z.string().optional(),
    networkProvider: z.nativeEnum(NetworkProvider).optional(),
    dataPlanCode: z.string().optional(),
    // Bill payment fields (TV, Power, Betting)
    billItemIdentifier: z.string().optional(),
    customerIdentifier: z.string().optional(),
    billerName: z.string().optional(),
    // Common optional fields
    customerId: z.string().uuid().optional(),
    orderId: z.string().uuid().optional(),
    source: z
      .enum([
        'checkout',
        'loyalty_reward',
        'direct',
        'gift',
        'storefront_modal',
      ])
      .default('direct'),
  })
  .refine(
    (data) => {
      if (data.type === 'airtime' || data.type === 'data') {
        return !!data.phoneNumber && !!data.networkProvider;
      }
      return true;
    },
    {
      message: 'phoneNumber and networkProvider are required for airtime/data',
      path: ['phoneNumber'],
    }
  )
  .refine(
    (data) => {
      if (
        data.type === 'electricity' ||
        data.type === 'cable_tv' ||
        data.type === 'betting'
      ) {
        return !!data.billItemIdentifier && !!data.customerIdentifier;
      }
      return true;
    },
    {
      message:
        'billItemIdentifier and customerIdentifier are required for bill payments',
      path: ['billItemIdentifier'],
    }
  );

export type PurchaseInput = z.infer<typeof purchaseSchema>;

export const verifySchema = z.object({
  billItemIdentifier: z.string().min(1, 'Bill item identifier is required'),
  customerIdentifier: z.string().min(1, 'Customer identifier is required'),
});

export type VerifyInput = z.infer<typeof verifySchema>;

export const billersQuerySchema = z.object({
  type: billTypeEnum,
});

export const loyaltyRedeemSchema = z.object({
  rewardId: z.string().uuid('Reward ID must be a valid UUID'),
  phoneNumber: z.string().min(1, 'Phone number is required'),
  networkProvider: z.nativeEnum(NetworkProvider),
});

export type LoyaltyRedeemInput = z.infer<typeof loyaltyRedeemSchema>;

/** Maps our bill type enum to commission calculation categories */
export const COMMISSION_CATEGORY_MAP: Record<BillType, string> = {
  airtime: 'AIRTIME',
  data: 'DATA',
  electricity: 'ELECTRICITY',
  cable_tv: 'CABLE',
  betting: 'BETTING',
};
