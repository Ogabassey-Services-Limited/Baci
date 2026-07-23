import { createServiceClient } from '@/lib/supabase/service';

export function createEventPipelineServiceRoleTestClient(
  fetch: typeof globalThis.fetch
) {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Event pipeline service-role test client is test-only');
  }
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const originalFetch = globalThis.fetch;
  try {
    process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'http://127.0.0.1:54321';
    process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'event-pipeline-service-test-key';
    globalThis.fetch = fetch;
    return createServiceClient('event-pipeline');
  } finally {
    if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
    globalThis.fetch = originalFetch;
  }
}
