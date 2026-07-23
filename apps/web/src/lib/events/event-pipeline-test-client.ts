import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

export function createEventPipelineTestClient(fetch: typeof globalThis.fetch) {
  return createClient<Database>(
    'http://127.0.0.1:54321',
    'event-pipeline-test-key',
    {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { fetch },
    }
  );
}
