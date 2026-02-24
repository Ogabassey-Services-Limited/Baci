import { z } from 'zod';

/**
 * Schema for validating media file IDs in DELETE requests.
 * Only allows alphanumeric characters, dots, and hyphens.
 * Explicitly rejects ".." to prevent directory/path traversal.
 */
export const mediaFileIdSchema = z
  .string()
  .min(1, 'File ID is required')
  .regex(/^[a-zA-Z0-9.-]+$/, 'Invalid File ID')
  .refine((val) => !val.includes('..'), 'Invalid File ID');

export type MediaFileId = z.infer<typeof mediaFileIdSchema>;
