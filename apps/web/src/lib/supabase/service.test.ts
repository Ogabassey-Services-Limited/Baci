import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Database } from '@/types/supabase';

const { mockCreateClient } = vi.hoisted(() => ({
  mockCreateClient: vi.fn((_url: string, _key: string, _options: unknown) => ({
    kind: 'service-client',
  })),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: (url: string, key: string, options: unknown) =>
    mockCreateClient(url, key, options),
}));
vi.mock('@/env', () => ({
  getSupabaseUrl: () => 'https://example.supabase.co',
}));

import { createServiceClient, type ServiceRoleClient } from './service';

function compileServiceFactoryTypes() {
  const legacy: SupabaseClient = createServiceClient();
  const sentinel: ServiceRoleClient = createServiceClient('event-pipeline');
  const typed: SupabaseClient<Database> = sentinel;
  const ordinary = {} as SupabaseClient<Database>;
  // @ts-expect-error An ordinary typed client cannot acquire service authority.
  const forbidden: ServiceRoleClient = ordinary;
  void [legacy, typed, forbidden];
}
void compileServiceFactoryTypes;

describe('service Supabase client factory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
  });

  it('preserves the legacy unbranded no-argument return', () => {
    const client = createServiceClient();
    expect(client).toEqual({ kind: 'service-client' });
    expect(Reflect.ownKeys(client)).not.toContainEqual(expect.any(Symbol));
  });

  it('brands only the opt-in event-pipeline client and keeps auth inert', () => {
    const client = createServiceClient('event-pipeline');
    expect(Reflect.ownKeys(client)).toContainEqual(expect.any(Symbol));
    expect(mockCreateClient).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'service-role-key',
      {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { fetch: globalThis.fetch },
      }
    );
  });

  it('fails closed without a service-role key', () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(() => createServiceClient()).toThrow(
      'SUPABASE_SERVICE_ROLE_KEY is missing'
    );
  });
});
