import type { NextRequest } from 'next/server';

export async function parseBlogPostMutationBody(
  request: NextRequest
): Promise<
  | { body: Record<string, unknown>; error: null }
  | { body: null; error: 'Invalid JSON body' }
> {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return { body: null, error: 'Invalid JSON body' };
    }

    return { body: body as Record<string, unknown>, error: null };
  } catch {
    return { body: null, error: 'Invalid JSON body' };
  }
}
