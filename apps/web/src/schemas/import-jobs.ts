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

export const importJobWorkerRequestSchema = z
  .object({
    jobId: z.string().uuid().optional(),
  })
  .strict();

export type ImportJobEntityType = z.infer<typeof importJobEntityTypeSchema>;
export type ImportJobRowsQuery = z.infer<typeof importJobRowsQuerySchema>;
export type ImportJobSourcePlatform = z.infer<
  typeof importJobSourcePlatformSchema
>;
export type ImportJobStatus = z.infer<typeof importJobStatusSchema>;
export type ImportJobUploadInput = z.infer<typeof importJobUploadSchema>;
export type ImportJobWorkerRequest = z.infer<
  typeof importJobWorkerRequestSchema
>;
