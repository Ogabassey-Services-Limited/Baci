import { z } from 'zod';

export const importJobSourcePlatformSchema = z.enum(['bumpa']);

export const importJobEntityTypeSchema = z.enum(['orders', 'products']);

export const importJobStatusSchema = z.enum([
  'uploaded',
  'validating',
  'preview_ready',
  'commit_queued',
  'committing',
  'committed',
  'notify_queued',
  'notifying',
  'completed',
  'failed',
]);

export const importJobParamsSchema = z.object({
  jobId: z.string().uuid(),
});

export const importJobRowsQuerySchema = z.object({
  filter: z.enum(['all', 'importable', 'needs_fix']).default('all'),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25),
});

export const importJobUploadSchema = z.object({
  sourcePlatform: importJobSourcePlatformSchema.default('bumpa'),
  entityType: importJobEntityTypeSchema,
});

export const importJobUploadInitSchema = importJobUploadSchema
  .extend({
    fileName: z.string().trim().min(1),
    fileSizeBytes: z.number().int().positive(),
    contentType: z.string().trim().min(1).nullable().optional(),
  })
  .strict();

export const importJobFinalizeSchema = z
  .object({
    clientUploadId: z.string().uuid(),
  })
  .strict();

export type ImportJobEntityType = z.infer<typeof importJobEntityTypeSchema>;
export type ImportJobRowsQuery = z.infer<typeof importJobRowsQuerySchema>;
export type ImportJobSourcePlatform = z.infer<
  typeof importJobSourcePlatformSchema
>;
export type ImportJobStatus = z.infer<typeof importJobStatusSchema>;
export type ImportJobUploadInput = z.infer<typeof importJobUploadSchema>;
export type ImportJobUploadInitInput = z.infer<
  typeof importJobUploadInitSchema
>;
export type ImportJobFinalizeInput = z.infer<typeof importJobFinalizeSchema>;
