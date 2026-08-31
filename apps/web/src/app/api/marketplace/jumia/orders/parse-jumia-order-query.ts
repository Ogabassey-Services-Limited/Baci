import { z } from 'zod';

const getQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(1000).prefault(50),
  offset: z.coerce.number().int().min(0).prefault(0),
  status: z.string().min(1).optional(),
  integrationId: z.uuid().optional(),
});

export function parseJumiaOrderQuery(searchParams: URLSearchParams) {
  return getQuerySchema.safeParse({
    limit: searchParams.get('limit') ?? undefined,
    offset: searchParams.get('offset') ?? undefined,
    status: searchParams.get('status') || undefined,
    integrationId: searchParams.get('integrationId') || undefined,
  });
}
