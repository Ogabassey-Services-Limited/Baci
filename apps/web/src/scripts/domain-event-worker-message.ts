import type { z } from 'zod';
import type { domainEventWorkerMessageSchema } from '@/schemas/domain-event-worker-message-schema';

export type DomainEventWorkerMessage = z.infer<
  typeof domainEventWorkerMessageSchema
>;
