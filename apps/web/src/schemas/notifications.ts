import { z } from 'zod';

/**
 * Schema for single notification ID validation
 */
export const notificationIdSchema = z.string().uuid();
