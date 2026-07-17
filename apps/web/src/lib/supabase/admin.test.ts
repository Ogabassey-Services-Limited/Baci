import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Database } from '@/types/supabase';

const { mockCreateClient } = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

vi.mock('@/env', () => ({
  getSupabaseServiceRoleKey: () => 'service-role-key',
  getSupabaseUrl: () => 'https://example.supabase.co',
}));

import { createAdminClient, createClient } from './admin';

function compileAdminFactoryTypes() {
  const legacy: SupabaseClient = createClient();
  const legacyAlias: SupabaseClient = createAdminClient();
  const sentinel: SupabaseClient<Database> = createClient('event-pipeline');
  const sentinelAlias: SupabaseClient<Database> =
    createAdminClient('event-pipeline');
  void [legacy, legacyAlias, sentinel, sentinelAlias];
}
void compileAdminFactoryTypes;

describe('supabase admin client factory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateClient.mockReturnValue({ kind: 'admin-client' });
  });

  it('exports the documented createClient factory and legacy createAdminClient alias', () => {
    expect(createClient()).toEqual({ kind: 'admin-client' });
    expect(createAdminClient()).toEqual({ kind: 'admin-client' });
    expect(mockCreateClient).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'service-role-key',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
    expect(mockCreateClient).toHaveBeenCalledTimes(2);
  });

  it('provides the opt-in generated event-pipeline client on both aliases', () => {
    expect(createClient('event-pipeline')).toEqual({ kind: 'admin-client' });
    expect(createAdminClient('event-pipeline')).toEqual({
      kind: 'admin-client',
    });
  });
});
