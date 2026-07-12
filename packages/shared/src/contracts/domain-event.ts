import { z } from 'zod';

const domainEventSourceSchema = z.strictObject({
  operation: z.enum(['INSERT', 'UPDATE', 'DELETE']).optional(),
  schema: z.string().min(1).max(63).optional(),
  table: z.string().min(1).max(63).optional(),
});

const domainEventSubjectSchema = z.strictObject({
  id: z.string().min(1).max(500),
  type: z.string().min(1).max(100),
});

const domainEventMetadataSchema = z.strictObject({
  environment: z.string().min(1).max(50),
  request_id: z
    .string()
    .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/)
    .optional(),
  shadow_only: z.boolean().optional(),
});

export const domainEventV1Schema = z.strictObject({
  causation_id: z.uuid().optional(),
  changed_fields: z.array(z.string().min(1).max(100)).max(100).optional(),
  correlation_id: z.string().min(1).max(200).optional(),
  data: z.record(z.string(), z.unknown()),
  domain_event_id: z.uuid(),
  event_name: z
    .string()
    .min(3)
    .max(150)
    .regex(/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+\.v1$/),
  external_event_id: z.string().min(1).max(500).optional(),
  idempotency_key: z.string().min(1).max(500),
  merchant_id: z.uuid().optional(),
  metadata: domainEventMetadataSchema,
  occurred_at: z.iso.datetime({ offset: true }),
  producer: z.enum(['database', 'web', 'mobile', 'worker']),
  schema_version: z.literal(1),
  source: domainEventSourceSchema,
  subject: domainEventSubjectSchema,
  trust_level: z.enum([
    'anonymous_client',
    'authenticated_client',
    'tenant_verified_client',
    'server',
    'database',
  ]),
});

export type DomainEventV1 = z.infer<typeof domainEventV1Schema>;
