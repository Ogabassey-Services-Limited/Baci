import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { mockFrom, mockRegister, mockGet } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockRegister: vi.fn(),
  mockGet: vi.fn(),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createClient: () => ({ from: mockFrom }),
}));
vi.mock('@/lib/zeptomail-domains', () => ({
  registerSendingDomain: mockRegister,
  getSendingDomain: mockGet,
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
  for (const method of ['select', 'eq', 'update', 'upsert']) {
    builder[method] = vi.fn(chain);
  }
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
    vi.clearAllMocks();
  });

  it('getMerchantEmailDomain maps a row into domain + DNS records', async () => {
    mockFrom.mockReturnValueOnce(builderFor({ data: ROW, error: null }));

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
    mockFrom.mockReturnValueOnce(builderFor({ data: null, error: null }));
    await expect(getMerchantEmailDomain('m1')).resolves.toBeNull();
  });

  it('registerMerchantEmailDomain registers with ZeptoMail then upserts pending', async () => {
    mockRegister.mockResolvedValue({
      domainKey: 'dk1',
      domain: 'mystore.com',
      verified: false,
      records: [
        { type: 'TXT', host: 'h', value: 'v' },
        { type: 'CNAME', host: 'b', value: 'c' },
      ],
    });
    const upsertBuilder = builderFor({
      data: {
        ...ROW,
        domain: 'mystore.com',
        status: 'pending',
        enabled: false,
      },
      error: null,
    });
    mockFrom.mockReturnValueOnce(upsertBuilder);

    const result = await registerMerchantEmailDomain('m1', 'mystore.com');

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

  it('verifyMerchantEmailDomain re-checks ZeptoMail and flips to verified', async () => {
    mockFrom.mockReturnValueOnce(
      builderFor({ data: { zeptomail_domain_id: 'dk1' }, error: null })
    );
    mockGet.mockResolvedValue({
      domainKey: 'dk1',
      domain: 'mystore.com',
      verified: true,
      records: [{ type: 'TXT', host: 'h', value: 'v' }],
    });
    const updateBuilder = builderFor({
      data: { ...ROW, status: 'verified' },
      error: null,
    });
    mockFrom.mockReturnValueOnce(updateBuilder);

    const result = await verifyMerchantEmailDomain('m1');

    expect(mockGet).toHaveBeenCalledWith('dk1');
    expect(updateBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'verified' })
    );
    expect(result.status).toBe('verified');
  });

  it('verifyMerchantEmailDomain throws when nothing is registered', async () => {
    mockFrom.mockReturnValueOnce(builderFor({ data: null, error: null }));
    await expect(verifyMerchantEmailDomain('m1')).rejects.toThrow(
      'No sending domain to verify'
    );
  });

  it('setMerchantEmailDomainEnabled refuses to enable an unverified domain', async () => {
    mockFrom.mockReturnValueOnce(
      builderFor({ data: { status: 'pending' }, error: null })
    );
    await expect(setMerchantEmailDomainEnabled('m1', true)).rejects.toThrow(
      'must be verified'
    );
  });

  it('setMerchantEmailDomainEnabled enables a verified domain', async () => {
    mockFrom.mockReturnValueOnce(
      builderFor({ data: { status: 'verified' }, error: null })
    );
    const updateBuilder = builderFor({ data: ROW, error: null });
    mockFrom.mockReturnValueOnce(updateBuilder);

    await setMerchantEmailDomainEnabled('m1', true);

    expect(updateBuilder.update).toHaveBeenCalledWith({ enabled: true });
  });
});
