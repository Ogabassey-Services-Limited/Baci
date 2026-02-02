import { z } from 'zod';

/**
 * Schema for payment reference validation
 */
export const referenceSchema = z.string().min(1).max(100);
