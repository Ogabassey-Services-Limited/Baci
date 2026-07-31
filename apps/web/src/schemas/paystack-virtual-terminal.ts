import { z } from 'zod';
import { merchantIdParamSchema } from '@/schemas/merchant-id-param';

export const virtualTerminalListQuerySchema = z.object({
  merchantId: merchantIdParamSchema,
});

export const createVirtualTerminalSchema = z.object({
  merchantId: merchantIdParamSchema,
  name: z.string().min(2, 'Account name must be at least 2 characters'),
  staffId: z.uuid().optional(),
  branchId: z.uuid().optional(),
  destinations: z
    .array(
      z.object({
        target: z
          .string()
          .regex(
            /^\+\d{10,15}$/,
            'Invalid phone number (E.164 format required)'
          ),
        name: z.string().min(1, 'Destination name is required'),
      })
    )
    .max(5, 'Maximum 5 WhatsApp destinations allowed')
    .optional()
    .default([]),
});
