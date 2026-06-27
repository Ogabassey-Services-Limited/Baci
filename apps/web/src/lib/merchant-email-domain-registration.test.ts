import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { mockScopedFrom, mockRegister, mockFind, mockVerify, mockAssociate } =
  vi.hoisted(() => ({
    mockScopedFrom: vi.fn(),
    mockRegister: vi.fn(),
    mockFind: vi.fn(),
    mockVerify: vi.fn(),
    mockAssociate: vi.fn(),
  }));

vi.mock('@/lib/supabase/admin', () => {
  throw new Error(
    'registerMerchantEmailDomain must not import service-role Supabase'
  );
});
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => Promise.resolve({ from: vi.fn() }),
}));
vi.mock('@/lib/zeptomail-domains', () => ({
  registerSendingDomain: mockRegister,
  findSendingDomainByName: mockFind,
  verifySendingDomain: mockVerify,
  associateSendingDomainWithConfiguredMailagent: mockAssociate,
}));

import { registerMerchantEmailDomain } from './merchant-email-domain';

type Result = { data?: unknown; error?: unknown };

function builderFor(result: Result) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  for (const method of ['select', 'eq', 'in', 'not', 'update', 'upsert']) {
    builder[method] = vi.fn(chain);
  }
  builder.is = vi.fn(chain);
  builder.limit = vi.fn(() => Promise.resolve(result));
  builder.maybeSingle = vi.fn(() => Promise.resolve(result));
  builder.single = vi.fn(() => Promise.resolve(result));
  return builder;
}

const ROW = {
  domain: 'ogabassey.com',
  sender_local_part: 'noreply',
  status: 'verified',
  enabled: true,
  dkim_host: 'sel._domainkey.ogabassey.com',
  dkim_value: 'k=rsa; p=AAA',
  bounce_host: 'bounce-zem.ogabassey.com',
  bounce_value: 'cluster89.zeptomail.com',
};

const scopedSupabase = {
  from: mockScopedFrom,
} as unknown as import('@supabase/supabase-js').SupabaseClient;

describe('registerMerchantEmailDomain', () => {
  beforeEach(() => {
    mockScopedFrom.mockReset();
    mockRegister.mockReset();
    mockFind.mockReset();
    mockVerify.mockReset();
    mockAssociate.mockReset();
    mockAssociate.mockImplementation((state) => Promise.resolve(state));
  });

  it('registerMerchantEmailDomain registers with ZeptoMail then upserts pending', async () => {
    mockRegister.mockResolvedValue({
      domainKey: 'dk1',
      domain: 'mystore.com',
      status: 'pending',
      verified: false,
      records: [
        { type: 'TXT', host: 'h', value: 'v' },
        { type: 'CNAME', host: 'b', value: 'c' },
      ],
    });
    mockScopedFrom.mockReturnValueOnce(
      builderFor({ data: [{ id: 'domain-id' }], error: null })
    );
    mockScopedFrom.mockReturnValueOnce(builderFor({ data: null, error: null }));
    const upsertBuilder = builderFor({
      data: {
        ...ROW,
        domain: 'mystore.com',
        status: 'pending',
        enabled: false,
      },
      error: null,
    });
    mockScopedFrom.mockReturnValueOnce(upsertBuilder);

    const result = await registerMerchantEmailDomain(
      'm1',
      'mystore.com',
      scopedSupabase
    );

    expect(mockRegister).toHaveBeenCalledWith('mystore.com');
    expect(upsertBuilder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        merchant_id: 'm1',
        domain: 'mystore.com',
        zeptomail_domain_id: 'dk1',
        status: 'pending',
        enabled: false,
        dkim_host: 'h',
        bounce_value: 'c',
      }),
      { onConflict: 'merchant_id' }
    );
    expect(result.status).toBe('pending');
  });

  it('preserves the stored enabled flag when re-registering the same domain', async () => {
    mockRegister.mockResolvedValue({
      domainKey: 'dk1',
      domain: 'ogabassey.com',
      status: 'verified',
      verified: true,
      records: [{ type: 'TXT', host: 'h', value: 'v' }],
    });
    // 1) ownership check passes
    mockScopedFrom.mockReturnValueOnce(
      builderFor({ data: [{ id: 'domain-id' }], error: null })
    );
    // 2) local owner = this merchant, already enabled
    mockScopedFrom.mockReturnValueOnce(
      builderFor({
        data: { merchant_id: 'm1', status: 'verified', enabled: true },
        error: null,
      })
    );
    // 3) upsert
    const upsertBuilder = builderFor({
      data: { ...ROW, domain: 'ogabassey.com' },
      error: null,
    });
    mockScopedFrom.mockReturnValueOnce(upsertBuilder);

    await registerMerchantEmailDomain('m1', 'ogabassey.com', scopedSupabase);

    // enabled must NOT be forced back to false for an idempotent re-register.
    expect(upsertBuilder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ merchant_id: 'm1', enabled: true }),
      { onConflict: 'merchant_id' }
    );
  });

  it('registerMerchantEmailDomain resumes when ZeptoMail already has the domain', async () => {
    mockRegister.mockRejectedValue(new Error('Domain already exists'));
    mockFind.mockResolvedValue({
      domainKey: 'existing-key',
      domain: 'mystore.com',
      status: 'pending',
      verified: false,
      records: [{ type: 'TXT', host: 'h', value: 'v' }],
    });
    mockScopedFrom.mockReturnValueOnce(
      builderFor({ data: [{ id: 'domain-id' }], error: null })
    );
    mockScopedFrom.mockReturnValueOnce(builderFor({ data: null, error: null }));
    const upsertBuilder = builderFor({
      data: { ...ROW, domain: 'mystore.com', status: 'pending' },
      error: null,
    });
    mockScopedFrom.mockReturnValueOnce(upsertBuilder);

    await expect(
      registerMerchantEmailDomain('m1', 'mystore.com', scopedSupabase)
    ).resolves.toMatchObject({ domain: 'mystore.com' });
    expect(mockFind).toHaveBeenCalledWith('mystore.com');
    expect(mockAssociate).toHaveBeenCalledWith(
      expect.objectContaining({ domainKey: 'existing-key' })
    );
    expect(upsertBuilder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ zeptomail_domain_id: 'existing-key' }),
      { onConflict: 'merchant_id' }
    );
  });

  it('registerMerchantEmailDomain requires an active verified storefront domain', async () => {
    mockScopedFrom.mockReturnValueOnce(builderFor({ data: [], error: null }));

    await expect(
      registerMerchantEmailDomain('m1', 'competitor.com', scopedSupabase)
    ).rejects.toThrow('active verified storefront domain');
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('registerMerchantEmailDomain refuses domains reserved by another merchant', async () => {
    mockScopedFrom.mockReturnValueOnce(
      builderFor({ data: [{ id: 'domain-id' }], error: null })
    );
    mockScopedFrom.mockReturnValueOnce(
      builderFor({
        data: { merchant_id: 'other-merchant', status: 'pending' },
        error: null,
      })
    );

    await expect(
      registerMerchantEmailDomain('m1', 'mystore.com', scopedSupabase)
    ).rejects.toThrow('already registered by another merchant');
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('surfaces hidden cross-merchant domain uniqueness conflicts as reservation errors', async () => {
    mockRegister.mockResolvedValue({
      domainKey: 'dk1',
      domain: 'mystore.com',
      status: 'pending',
      verified: false,
      records: [{ type: 'TXT', host: 'h', value: 'v' }],
    });
    mockScopedFrom.mockReturnValueOnce(
      builderFor({ data: [{ id: 'domain-id' }], error: null })
    );
    // RLS can hide another merchant's reserved sending-domain row.
    mockScopedFrom.mockReturnValueOnce(builderFor({ data: null, error: null }));
    mockScopedFrom.mockReturnValueOnce(
      builderFor({
        data: null,
        error: {
          code: '23505',
          message:
            'duplicate key value violates unique constraint "merchant_email_domains_domain_key"',
        },
      })
    );

    await expect(
      registerMerchantEmailDomain('m1', 'mystore.com', scopedSupabase)
    ).rejects.toThrow('already registered by another merchant');
  });

  it('registerMerchantEmailDomain refuses already-verified ZeptoMail domains without local ownership', async () => {
    mockRegister.mockRejectedValue(new Error('Domain already exists'));
    mockFind.mockResolvedValue({
      domainKey: 'existing-key',
      domain: 'mystore.com',
      status: 'verified',
      verified: true,
      records: [{ type: 'TXT', host: 'h', value: 'v' }],
    });
    mockScopedFrom.mockReturnValueOnce(
      builderFor({ data: [{ id: 'domain-id' }], error: null })
    );
    mockScopedFrom.mockReturnValueOnce(builderFor({ data: null, error: null }));

    await expect(
      registerMerchantEmailDomain('m1', 'mystore.com', scopedSupabase)
    ).rejects.toThrow('already verified in ZeptoMail');
  });
});
