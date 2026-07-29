import { z } from 'zod';

const auditFilterPattern = /^[a-z0-9][a-z0-9._-]*$/;
const emptyStringToUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim().length === 0 ? undefined : value;

const optionalAuditFilter = (maximumLength: number) =>
  z.preprocess(
    emptyStringToUndefined,
    z
      .string()
      .trim()
      .min(1)
      .max(maximumLength)
      .regex(auditFilterPattern)
      .optional()
  );

const optionalCursorOccurredAt = z.preprocess(
  emptyStringToUndefined,
  z.iso.datetime({ offset: true }).optional()
);

const optionalCursorId = z.preprocess(
  emptyStringToUndefined,
  z.string().trim().pipe(z.uuid()).optional()
);

export const auditEventQuerySchema = z
  .strictObject({
    action: optionalAuditFilter(100),
    cursorId: optionalCursorId,
    cursorOccurredAt: optionalCursorOccurredAt,
    limit: z.preprocess(
      emptyStringToUndefined,
      z.coerce.number().int().min(1).max(100).default(50)
    ),
    merchantId: z.string().trim().pipe(z.uuid()),
    resourceType: optionalAuditFilter(80),
  })
  .superRefine((query, context) => {
    if (Boolean(query.cursorOccurredAt) === Boolean(query.cursorId)) {
      return;
    }

    context.addIssue({
      code: 'custom',
      message: 'cursorOccurredAt and cursorId must be provided together',
      path: query.cursorOccurredAt ? ['cursorId'] : ['cursorOccurredAt'],
    });
  });

export type AuditEventQuery = z.infer<typeof auditEventQuerySchema>;
