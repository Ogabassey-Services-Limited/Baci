import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const {
  mockScopedFrom,
  mockScopedRpc,
  mockServerFrom,
  mockRegister,
  mockFind,
  mockVerify,
  mockAssociate,
  mockVercelVerifyDomain,
} = vi.hoisted(() => ({
  mockScopedFrom: vi.fn(),
  mockScopedRpc: vi.fn(),
  mockServerFrom: vi.fn(),
  mockRegister: vi.fn(),
  mockFind: vi.fn(),
  mockVerify: vi.fn(),
  mockAssociate: vi.fn(),
  mockVercelVerifyDomain: vi.fn(),
}));

vi.mock('@/lib/supabase/admin', () => {
  throw new Error(
    'merchant-email-domain service must not import service-role Supabase'
  );
});
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => Promise.resolve({ from: mockServerFrom }),
}));
vi.mock('@/lib/zeptomail-domains', () => ({
  registerSendingDomain: mockRegister,
  findSendingDomainByName: mockFind,
  verifySendingDomain: mockVerify,
  associateSendingDomainWithConfiguredMailagent: mockAssociate,
}));
vi.mock('@/lib/vercel', () => ({
  vercel: {
    verifyDomain: mockVercelVerifyDomain,
  },
}));

import {
  getMerchantEmailDomain,
  registerMerchantEmailDomain,
  setMerchantEmailDomainEnabled,
  verifyMerchantEmailDomain,
} from './merchant-email-domain';

type Result = { data?: unknown; error?: unknown };

/** A chainable Supabase query-builder stub that resolves to `result`. */
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
  Object.defineProperty(builder, 'then', {
    value: vi.fn((resolve, reject) =>
      Promise.resolve(result).then(resolve, reject)
    ),
  });
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
  rpc: mockScopedRpc,
} as unknown as import('@supabase/supabase-js').SupabaseClient;

describe('merchant-email-domain service', () => {
  beforeEach(() => {
    mockScopedFrom.mockReset();
    mockScopedRpc.mockReset();
    mockServerFrom.mockReset();
    mockRegister.mockReset();
    mockFind.mockReset();
    mockVerify.mockReset();
    mockAssociate.mockReset();
    mockVercelVerifyDomain.mockReset();
    mockVercelVerifyDomain.mockResolvedValue({
      name: 'ogabassey.com',
      apexName: 'ogabassey.com',
      projectId: 'project_1',
      verified: true,
    });
  });

  it('getMerchantEmailDomain maps a row into domain + DNS records', async () => {
    mockServerFrom.mockReturnValueOnce(builderFor({ data: ROW, error: null }));

    const result = await getMerchantEmailDomain('m1');

    expect(result).toEqual({
      domain: 'ogabassey.com',
      senderLocalPart: 'noreply',
      status: 'verified',
      enabled: true,
      records: [
        { type: 'TXT', host: ROW.dkim_host, value: ROW.dkim_value },
        { type: 'CNAME', host: ROW.bounce_host, value: ROW.bounce_value },
      ],
    });
  });

  it('getMerchantEmailDomain returns null when no row exists', async () => {
    mockServerFrom.mockReturnValueOnce(builderFor({ data: null, error: null }));
    await expect(getMerchantEmailDomain('m1')).resolves.toBeNull();
  });

  it('verifyMerchantEmailDomain re-checks ZeptoMail and flips to verified', async () => {
    mockScopedFrom.mockReturnValueOnce(
      builderFor({ data: { ...ROW, zeptomail_domain_id: 'dk1' }, error: null })
    );
    mockVerify.mockResolvedValue({
      domainKey: 'dk1',
      domain: 'mystore.com',
      status: 'verified',
      verified: true,
      records: [{ type: 'TXT', host: 'h', value: 'v' }],
      associatedMailagentKeys: ['mail_agent_1'],
    });
    const updateBuilder = builderFor({
      data: { ...ROW, status: 'verified' },
      error: null,
    });
    mockScopedRpc.mockReturnValueOnce(updateBuilder);

    const result = await verifyMerchantEmailDomain('m1', scopedSupabase);

    expect(mockVerify).toHaveBeenCalledWith('dk1');
    expect(mockScopedRpc).toHaveBeenCalledWith(
      'save_merchant_email_domain_verification',
      expect.objectContaining({ p_status: 'verified' })
    );
    expect(result.status).toBe('verified');
  });

  it('verifyMerchantEmailDomain recovers a missing local ZeptoMail domain id', async () => {
    mockScopedFrom.mockReturnValueOnce(
      builderFor({
        data: { ...ROW, domain: 'mystore.com', zeptomail_domain_id: null },
        error: null,
      })
    );
    mockFind.mockResolvedValue({
      domainKey: 'recovered-key',
      domain: 'mystore.com',
      status: 'pending',
      verified: false,
      records: [{ type: 'TXT', host: 'h', value: 'v' }],
      associatedMailagentKeys: ['mail_agent_1'],
    });
    mockVerify.mockResolvedValue({
      domainKey: 'recovered-key',
      domain: 'mystore.com',
      status: 'verified',
      verified: true,
      records: [{ type: 'TXT', host: 'h', value: 'v' }],
      associatedMailagentKeys: ['mail_agent_1'],
    });
    const updateBuilder = builderFor({ data: ROW, error: null });
    mockScopedRpc.mockReturnValueOnce(updateBuilder);

    await verifyMerchantEmailDomain('m1', scopedSupabase);

    expect(mockFind).toHaveBeenCalledWith('mystore.com');
    expect(mockVerify).toHaveBeenCalledWith('recovered-key');
    expect(mockScopedRpc).toHaveBeenCalledWith(
      'save_merchant_email_domain_verification',
      expect.objectContaining({
        p_checked_domain: 'mystore.com',
        p_checked_zeptomail_domain_id: null,
        p_zeptomail_domain_id: 'recovered-key',
      })
    );
  });

  it('verifyMerchantEmailDomain returns a seeded verified row without a ZeptoMail id when recovery is unavailable', async () => {
    mockScopedFrom.mockReturnValueOnce(
      builderFor({
        data: { ...ROW, zeptomail_domain_id: null },
        error: null,
      })
    );
    mockFind.mockResolvedValue(null);

    const result = await verifyMerchantEmailDomain('m1', scopedSupabase);

    expect(mockFind).toHaveBeenCalledWith('ogabassey.com');
    expect(mockVerify).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      domain: 'ogabassey.com',
      status: 'verified',
    });
  });

  it('verifyMerchantEmailDomain persists failed verification status', async () => {
    mockScopedFrom.mockReturnValueOnce(
      builderFor({
        data: { ...ROW, zeptomail_domain_id: 'dk1', status: 'pending' },
        error: null,
      })
    );
    mockVerify.mockResolvedValue({
      domainKey: 'dk1',
      domain: 'mystore.com',
      status: 'failed',
      verified: false,
      records: [{ type: 'TXT', host: 'h', value: 'v' }],
      associatedMailagentKeys: ['mail_agent_1'],
    });
    const updateBuilder = builderFor({
      data: { ...ROW, status: 'failed', enabled: false },
      error: null,
    });
    mockScopedRpc.mockReturnValueOnce(updateBuilder);

    const result = await verifyMerchantEmailDomain('m1', scopedSupabase);

    expect(mockScopedRpc).toHaveBeenCalledWith(
      'save_merchant_email_domain_verification',
      expect.objectContaining({ p_status: 'failed' })
    );
    expect(result.status).toBe('failed');
  });

  it('verifyMerchantEmailDomain refuses to update when the stored domain changes mid-verification', async () => {
    mockScopedFrom.mockReturnValueOnce(
      builderFor({
        data: { ...ROW, domain: 'old.example', zeptomail_domain_id: 'old-key' },
        error: null,
      })
    );
    mockVerify.mockResolvedValue({
      domainKey: 'old-key',
      domain: 'old.example',
      status: 'verified',
      verified: true,
      records: [{ type: 'TXT', host: 'h', value: 'v' }],
      associatedMailagentKeys: ['mail_agent_1'],
    });
    const updateBuilder = builderFor({ data: null, error: null });
    mockScopedRpc.mockReturnValueOnce(updateBuilder);

    await expect(
      verifyMerchantEmailDomain('m1', scopedSupabase)
    ).rejects.toThrow('changed while verification was in progress');
    expect(mockScopedRpc).toHaveBeenCalledWith(
      'save_merchant_email_domain_verification',
      expect.objectContaining({
        p_checked_domain: 'old.example',
        p_checked_zeptomail_domain_id: 'old-key',
      })
    );
  });

  it('verifyMerchantEmailDomain throws when nothing is registered', async () => {
    mockScopedFrom.mockReturnValueOnce(builderFor({ data: null, error: null }));
    await expect(
      verifyMerchantEmailDomain('m1', scopedSupabase)
    ).rejects.toThrow('No sending domain to verify');
  });

  it('setMerchantEmailDomainEnabled refuses to enable an unverified domain', async () => {
    mockScopedFrom.mockReturnValueOnce(
      builderFor({
        data: { domain: 'ogabassey.com', status: 'pending' },
        error: null,
      })
    );
    await expect(
      setMerchantEmailDomainEnabled('m1', true, scopedSupabase)
    ).rejects.toThrow('must be verified');
  });

  it('setMerchantEmailDomainEnabled enables a verified domain via a scoped update', async () => {
    const readBuilder = builderFor({
      data: { domain: 'ogabassey.com', status: 'verified' },
      error: null,
    });
    const ownershipBuilder = builderFor({
      data: [{ id: 'domain-1', domain: 'ogabassey.com' }],
      error: null,
    });
    const updateBuilder = builderFor({ data: ROW, error: null });
    mockScopedFrom.mockReturnValueOnce(readBuilder);
    mockScopedFrom.mockReturnValueOnce(ownershipBuilder);
    mockScopedRpc.mockReturnValueOnce(updateBuilder);

    await setMerchantEmailDomainEnabled('m1', true, scopedSupabase);

    expect(ownershipBuilder.in).toHaveBeenCalledWith('domain', [
      'ogabassey.com',
      'www.ogabassey.com',
    ]);
    expect(ownershipBuilder.eq).toHaveBeenCalledWith('status', 'active');
    expect(mockVercelVerifyDomain).toHaveBeenCalledWith('ogabassey.com');
    expect(mockScopedRpc).toHaveBeenCalledWith(
      'set_merchant_email_domain_enabled',
      expect.objectContaining({
        p_actor_user_id: null,
        p_merchant_id: 'm1',
        p_enabled: true,
      })
    );
  });

  it('setMerchantEmailDomainEnabled checks all apex/www storefront candidates before rejecting', async () => {
    mockScopedFrom.mockReturnValueOnce(
      builderFor({
        data: { domain: 'mystore.com', status: 'verified' },
        error: null,
      })
    );
    mockScopedFrom.mockReturnValueOnce(
      builderFor({
        data: [
          { id: 'domain-1', domain: 'mystore.com' },
          { id: 'domain-2', domain: 'www.mystore.com' },
        ],
        error: null,
      })
    );
    mockVercelVerifyDomain
      .mockResolvedValueOnce({
        name: 'mystore.com',
        apexName: 'mystore.com',
        projectId: 'project_1',
        verified: false,
        verification: [
          {
            type: 'TXT',
            domain: '_vercel.mystore.com',
            value: 'token',
            reason: 'Missing TXT record',
          },
        ],
      })
      .mockResolvedValueOnce({
        name: 'www.mystore.com',
        apexName: 'mystore.com',
        projectId: 'project_1',
        verified: true,
      });
    mockScopedRpc.mockReturnValueOnce(builderFor({ data: ROW, error: null }));

    await expect(
      setMerchantEmailDomainEnabled('m1', true, scopedSupabase)
    ).resolves.toMatchObject({ enabled: true });

    expect(mockVercelVerifyDomain).toHaveBeenCalledWith('mystore.com');
    expect(mockVercelVerifyDomain).toHaveBeenCalledWith('www.mystore.com');
    expect(mockScopedRpc).toHaveBeenCalled();
  });

  it('setMerchantEmailDomainEnabled requires live Vercel verification before enabling', async () => {
    mockScopedFrom.mockReturnValueOnce(
      builderFor({
        data: { domain: 'ogabassey.com', status: 'verified' },
        error: null,
      })
    );
    mockScopedFrom.mockReturnValueOnce(
      builderFor({
        data: [{ id: 'domain-1', domain: 'ogabassey.com' }],
        error: null,
      })
    );
    mockVercelVerifyDomain.mockResolvedValueOnce({
      name: 'ogabassey.com',
      apexName: 'ogabassey.com',
      projectId: 'project_1',
      verified: false,
      verification: [
        {
          type: 'TXT',
          domain: '_vercel.ogabassey.com',
          value: 'token',
          reason: 'Missing TXT record',
        },
      ],
    });

    await expect(
      setMerchantEmailDomainEnabled('m1', true, scopedSupabase)
    ).rejects.toThrow('active verified storefront domain');
    expect(mockScopedRpc).not.toHaveBeenCalled();
  });

  it('setMerchantEmailDomainEnabled re-checks active storefront ownership before enabling', async () => {
    mockScopedFrom.mockReturnValueOnce(
      builderFor({
        data: { domain: 'ogabassey.com', status: 'verified' },
        error: null,
      })
    );
    mockScopedFrom.mockReturnValueOnce(builderFor({ data: [], error: null }));

    await expect(
      setMerchantEmailDomainEnabled('m1', true, scopedSupabase)
    ).rejects.toThrow('active verified storefront domain');
  });

  it('registerMerchantEmailDomain associates reused ZeptoMail domains with the configured agent', async () => {
    const existing = {
      domainKey: 'dk1',
      domain: 'ogabassey.com',
      status: 'pending',
      verified: false,
      records: [{ type: 'TXT', host: 'h', value: 'v' }],
      associatedMailagentKeys: [],
    };
    mockScopedFrom.mockReturnValueOnce(
      builderFor({
        data: [{ id: 'domain-1', domain: 'ogabassey.com' }],
        error: null,
      })
    );
    mockScopedFrom.mockReturnValueOnce(
      builderFor({
        data: { merchant_id: 'm1', status: 'pending', enabled: false },
        error: null,
      })
    );
    mockRegister.mockRejectedValue(new Error('Domain already exists'));
    mockFind.mockResolvedValue(existing);
    mockAssociate.mockResolvedValue({
      ...existing,
      associatedMailagentKeys: ['mail_agent_1'],
    });
    mockScopedRpc.mockReturnValueOnce(builderFor({ data: ROW, error: null }));

    await registerMerchantEmailDomain('m1', 'ogabassey.com', scopedSupabase);

    expect(mockAssociate).toHaveBeenCalledWith(existing);
  });
});
