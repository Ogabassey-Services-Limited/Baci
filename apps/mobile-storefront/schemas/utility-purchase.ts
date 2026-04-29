import { z } from 'zod';

export const RouteRepeatParamsSchema = z.object({
  repeatAmount: z.string().optional(),
  repeatBillerName: z.string().optional(),
  repeatBillItemIdentifier: z.string().optional(),
  repeatCustomerIdentifier: z.string().optional(),
  repeatDataPlanCode: z.string().optional(),
  repeatNetworkProvider: z.string().optional(),
  repeatPhoneNumber: z.string().optional(),
  repeatVerified: z.string().optional(),
});
