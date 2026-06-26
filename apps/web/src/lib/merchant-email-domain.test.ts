import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const {
  mockAdminFrom,
  mockServerFrom,
  mockRegister,
  mockFind,
  mockVerify,
  mockAssociate,
} = vi.hoisted(() => ({
  mockAdminFrom: vi.fn(),
  mockServerFrom: vi.fn(),
  mockRegister: vi.fn(),
  mockFind: vi.fn(),
  mockVerify: vi.fn(),
  mockAssociate: vi.fn(),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createClient: () => ({ from: mockAdminFrom }),
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => Promise.resolve({ from: mockServerFrom }),
}));
vi.mock('@/lib/zeptomail-domains', () => ({
  registerSendingDomain: mockRegister,
  findSendingDomainByName: mockFind,
  verifySendingDomain: mockVerify,
  associateSendingDomainWithConfiguredMailagent: mockAssociate,
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

describe('merchant-email-domain service', () => {
  beforeEach(() => {
    mockAdminFrom.mockReset();
    mockServerFrom.mockReset();
    mockRegister.mockReset();
    mockFind.mockReset();
    mockVerify.mockReset();
    mockAssociate.mockReset();
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
    mockAdminFrom.mockReturnValueOnce(
      builderFor({ data: { zeptomail_domain_id: 'dk1' }, error: null })
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
    mockAdminFrom.mockReturnValueOnce(updateBuilder);

    const result = await verifyMerchantEmailDomain('m1');

    expect(mockVerify).toHaveBeenCalledWith('dk1');
    expect(updateBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'verified' })
    );
    expect(result.status).toBe('verified');
  });

  it('verifyMerchantEmailDomain recovers a missing local ZeptoMail domain id', async () => {
    mockAdminFrom.mockReturnValueOnce(
      builderFor({
        data: { domain: 'mystore.com', zeptomail_domain_id: null },
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
    mockAdminFrom.mockReturnValueOnce(updateBuilder);

    await verifyMerchantEmailDomain('m1');

    expect(mockFind).toHaveBeenCalledWith('mystore.com');
    expect(mockVerify).toHaveBeenCalledWith('recovered-key');
    expect(updateBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ zeptomail_domain_id: 'recovered-key' })
    );
  });

  it('verifyMerchantEmailDomain returns a seeded verified row without a ZeptoMail id when recovery is unavailable', async () => {
    mockAdminFrom.mockReturnValueOnce(
      builderFor({
        data: { ...ROW, zeptomail_domain_id: null },
        error: null,
      })
    );
    mockFind.mockResolvedValue(null);

    const result = await verifyMerchantEmailDomain('m1');

    expect(mockFind).toHaveBeenCalledWith('ogabassey.com');
    expect(mockVerify).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      domain: 'ogabassey.com',
      status: 'verified',
    });
  });

  it('verifyMerchantEmailDomain persists failed verification status', async () => {
    mockAdminFrom.mockReturnValueOnce(
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
    mockAdminFrom.mockReturnValueOnce(updateBuilder);

    const result = await verifyMerchantEmailDomain('m1');

    expect(updateBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed' })
    );
    expect(result.status).toBe('failed');
  });

  it('verifyMerchantEmailDomain throws when nothing is registered', async () => {
    mockAdminFrom.mockReturnValueOnce(builderFor({ data: null, error: null }));
    await expect(verifyMerchantEmailDomain('m1')).rejects.toThrow(
      'No sending domain to verify'
    );
  });

  it('setMerchantEmailDomainEnabled refuses to enable an unverified domain', async () => {
    mockAdminFrom.mockReturnValueOnce(
      builderFor({
        data: { domain: 'ogabassey.com', status: 'pending' },
        error: null,
      })
    );
    await expect(setMerchantEmailDomainEnabled('m1', true)).rejects.toThrow(
      'must be verified'
    );
  });

  it('setMerchantEmailDomainEnabled enables a verified domain via a scoped update', async () => {
    const readBuilder = builderFor({
      data: { domain: 'ogabassey.com', status: 'verified' },
      error: null,
    });
    const ownershipBuilder = builderFor({
      data: [{ id: 'domain-1' }],
      error: null,
    });
    const updateBuilder = builderFor({ data: ROW, error: null });
    mockAdminFrom.mockReturnValueOnce(readBuilder);
    mockAdminFrom.mockReturnValueOnce(ownershipBuilder);
    mockAdminFrom.mockReturnValueOnce(updateBuilder);

    await setMerchantEmailDomainEnabled('m1', true);

    expect(ownershipBuilder.in).toHaveBeenCalledWith('domain', [
      'ogabassey.com',
      'www.ogabassey.com',
    ]);
    expect(ownershipBuilder.eq).toHaveBeenCalledWith('status', 'active');
    expect(updateBuilder.update).toHaveBeenCalledWith({ enabled: true });
    expect(updateBuilder.eq).toHaveBeenCalledWith('status', 'verified');
  });

  it('setMerchantEmailDomainEnabled re-checks active storefront ownership before enabling', async () => {
    mockAdminFrom.mockReturnValueOnce(
      builderFor({
        data: { domain: 'ogabassey.com', status: 'verified' },
        error: null,
      })
    );
    mockAdminFrom.mockReturnValueOnce(builderFor({ data: [], error: null }));

    await expect(setMerchantEmailDomainEnabled('m1', true)).rejects.toThrow(
      'active verified storefront domain'
    );
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
    mockAdminFrom.mockReturnValueOnce(
      builderFor({ data: [{ id: 'domain-1' }], error: null })
    );
    mockAdminFrom.mockReturnValueOnce(
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
    mockAdminFrom.mockReturnValueOnce(builderFor({ data: ROW, error: null }));

    await registerMerchantEmailDomain('m1', 'ogabassey.com');

    expect(mockAssociate).toHaveBeenCalledWith(existing);
  });
});
