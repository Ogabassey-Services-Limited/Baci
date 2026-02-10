import { z } from 'zod';

/**
 * VTU Biller Schema - 2026 Best Practice
 * Ensures runtime integrity of biller data from external APIs.
 */
export const BillerSchema = z.object({
    billerId: z.string().describe('Unique identifier for the biller/provider'),
    billerName: z.string().describe('Display name of the biller'),
    billerType: z.string().describe('Type of biller (e.g., AIRTIME, DATA)'),
    categoryId: z.string().describe('Category ID from the Kuda API'),
    categoryName: z.string().describe('Display name of the category'),
});

/**
 * VTU Biller List Response Schema
 */
export const BillerListSchema = z.object({
    billers: z.array(BillerSchema),
});

export type Biller = z.infer<typeof BillerSchema>;
export type BillerListResponse = z.infer<typeof BillerListSchema>;
