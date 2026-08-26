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

import {
  type AdsCredentialServiceClient,
  createServiceClient,
  type ServiceRoleClient,
} from './service';

// biome-ignore format: compile-only overload exactness proof.
type ServiceReturnIsLegacy = Expect<Equal<ReturnType<typeof createServiceClient>, SupabaseClient>>;
function compileServiceFactoryTypes() {
  const exactReturn: ServiceReturnIsLegacy = true;
  const returnType: ReturnType<typeof createServiceClient> =
    createServiceClient();
  const legacy: SupabaseClient = returnType;
  const sentinel: ServiceRoleClient = createServiceClient('event-pipeline');
  const typed: SupabaseClient<Database> = sentinel;
  const adsCredentials: AdsCredentialServiceClient =
    createServiceClient('ads-credentials');
  const adsTyped: SupabaseClient<Database> = adsCredentials;
  const ordinary = {} as SupabaseClient<Database>;
  // @ts-expect-error An ordinary typed client cannot acquire service authority.
  const forbidden: ServiceRoleClient = ordinary;
  // @ts-expect-error Ads credential authority must not be interchangeable with event-pipeline authority.
  const forbiddenAdsAsEventPipeline: ServiceRoleClient = adsCredentials;
  void [
    exactReturn,
    legacy,
    typed,
    adsTyped,
    forbidden,
    forbiddenAdsAsEventPipeline,
  ];
}
void compileServiceFactoryTypes;

describe('service Supabase client factory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.SUPABASE_ADS_CREDENTIAL_KEY;
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

  it('prefers the dedicated Ads credential key and brands that authority separately', () => {
    process.env.SUPABASE_ADS_CREDENTIAL_KEY = 'ads-credential-key';

    const client = createServiceClient('ads-credentials');

    expect(Reflect.ownKeys(client)).toContainEqual(expect.any(Symbol));
    expect(mockCreateClient).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'ads-credential-key',
      {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { fetch: globalThis.fetch },
      }
    );
  });

  it('falls back to the existing service-role key during deployment migration', () => {
    const client = createServiceClient('ads-credentials');

    expect(Reflect.ownKeys(client)).toContainEqual(expect.any(Symbol));
    expect(mockCreateClient).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'service-role-key',
      expect.any(Object)
    );
  });

  it('fails closed without a service-role key', () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(() => createServiceClient()).toThrow(
      'SUPABASE_SERVICE_ROLE_KEY is missing'
    );
  });

  it('fails closed when neither Ads nor compatibility credentials are configured', () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    expect(() => createServiceClient('ads-credentials')).toThrow(
      'SUPABASE_ADS_CREDENTIAL_KEY or SUPABASE_SERVICE_ROLE_KEY is missing'
    );
  });
});
