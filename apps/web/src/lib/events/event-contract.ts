import {
  type DomainEventV1,
  domainEventV1Schema,
} from '@baci/shared/contracts';

export type DomainEventParseResult =
  | { event: DomainEventV1; success: true }
  | { issues: string[]; success: false };

export function parseDomainEventV1(payload: unknown): DomainEventParseResult {
  const result = domainEventV1Schema.safeParse(payload);
  if (result.success) return { event: result.data, success: true };
  return {
    issues: result.error.issues.map((issue) =>
      issue.path.length > 0
        ? `${issue.path.join('.')}:${issue.code}`
        : issue.code
    ),
    success: false,
  };
}
