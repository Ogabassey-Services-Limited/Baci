import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Database } from '@/types/supabase';

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <
    Value,
  >() => Value extends Right ? 1 : 2
    ? true
    : false;
type Expect<Value extends true> = Value;

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

// biome-ignore format: compile-only overload exactness proofs.
type AdminReturnIsLegacy = Expect<Equal<ReturnType<typeof createClient>, SupabaseClient>>;
// biome-ignore format: compile-only alias exactness proof.
type AdminAliasReturnIsLegacy = Expect<Equal<ReturnType<typeof createAdminClient>, SupabaseClient>>;
function compileAdminFactoryTypes() {
  const exactReturn: AdminReturnIsLegacy = true;
  const exactAliasReturn: AdminAliasReturnIsLegacy = true;
  const primaryReturn: ReturnType<typeof createClient> = createClient();
  const aliasReturn: ReturnType<typeof createAdminClient> = createAdminClient();
  const legacy: SupabaseClient = primaryReturn;
  const legacyAlias: SupabaseClient = aliasReturn;
  const sentinel: SupabaseClient<Database> = createClient('event-pipeline');
  const sentinelAlias: SupabaseClient<Database> =
    createAdminClient('event-pipeline');
  void [
    exactReturn,
    exactAliasReturn,
    legacy,
    legacyAlias,
    sentinel,
    sentinelAlias,
  ];
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
