import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const ENV = {
  ZOHO_CLIENT_ID: 'cid',
  ZOHO_CLIENT_SECRET: 'csec',
  ZOHO_REFRESH_TOKEN: 'rtok',
  ZEPTOMAIL_MAILAGENT_KEY: 'mail_agent_1',
};

const TOKEN_OK = {
  ok: true,
  json: () => Promise.resolve({ access_token: 'at', expires_in: 3600 }),
};

function domainResponse(dkimStatus: string, cnameStatus: string) {
  return {
    ok: true,
    json: () =>
      Promise.resolve({
        data: [
          {
            domain_name: 'ogabassey.com',
            domain_key: 'dk1',
            domain_status: 'active',
            dkim: {
              host: '24132322._domainkey.ogabassey.com',
              public_key: 'k=rsa; p=AAA',
              selector: '24132322',
              status: dkimStatus,
            },
            cname: {
              host: 'bounce-zem.ogabassey.com',
              cname_record: 'cluster89.zeptomail.com',
              status: cnameStatus,
            },
          },
        ],
      }),
  };
}

const fetchMock = vi.fn();

function routeFetch(handlers: { token?: unknown; domains?: unknown }) {
  fetchMock.mockImplementation((url: string | URL | Request) => {
    const href = String(url);
    if (href.includes('accounts.zoho.com')) {
      return Promise.resolve(handlers.token ?? TOKEN_OK);
    }
    return Promise.resolve(handlers.domains);
  });
}

function load() {
  vi.resetModules();
  return import('./zeptomail-domains');
}

describe('zeptomail-domains client', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    for (const [k, v] of Object.entries(ENV)) {
      vi.stubEnv(k, v);
    }
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('isZeptomailDomainsConfigured reflects trimmed env presence', async () => {
    const mod = await load();
    expect(mod.isZeptomailDomainsConfigured()).toBe(true);
    vi.stubEnv('ZOHO_REFRESH_TOKEN', '   ');
    const reloaded = await load();
    expect(reloaded.isZeptomailDomainsConfigured()).toBe(false);
  });

  it('registerSendingDomain posts the domain and maps DKIM + CNAME records', async () => {
    routeFetch({ domains: domainResponse('unverified', 'unverified') });
    const mod = await load();

    const state = await mod.registerSendingDomain('ogabassey.com');

    // The POST body carries the domain + mailagent + bounce prefix.
    const domainCall = fetchMock.mock.calls.find((c) =>
      String(c[0]).endsWith('/domains')
    );
    const body = JSON.parse((domainCall?.[1] as RequestInit).body as string);
    expect(body).toMatchObject({
      domain_name: 'ogabassey.com',
      mailagent_keys: ['mail_agent_1'],
      sub_domain_prefix: 'bounce-zem',
    });

    expect(state.domainKey).toBe('dk1');
    expect(state.status).toBe('pending');
    expect(state.verified).toBe(false);
    expect(state.records).toEqual([
      {
        type: 'TXT',
        host: '24132322._domainkey.ogabassey.com',
        value: 'k=rsa; p=AAA',
      },
      {
        type: 'CNAME',
        host: 'bounce-zem.ogabassey.com',
        value: 'cluster89.zeptomail.com',
      },
    ]);
  });

  it('accepts ZeptoMail add-domain object responses', async () => {
    routeFetch({
      domains: {
        ok: true,
        json: async () => ({
          data: {
            domain_name: 'ogabassey.com',
            domain_key: 'dk1',
            status: 'unverified',
            dkim: {
              host: '24132322._domainkey.ogabassey.com',
              public_key: 'k=rsa; p=AAA',
              status: 'unverified',
            },
            cname: {
              host: 'bounce-zem.ogabassey.com',
              cname_record: 'cluster89.zeptomail.com',
              status: 'unverified',
            },
          },
        }),
      },
    });
    const mod = await load();

    await expect(mod.registerSendingDomain('ogabassey.com')).resolves.toEqual(
      expect.objectContaining({
        domainKey: 'dk1',
        records: expect.arrayContaining([
          expect.objectContaining({ type: 'TXT' }),
          expect.objectContaining({ type: 'CNAME' }),
        ]),
      })
    );
  });

  it('adds abort signals to Zoho token and ZeptoMail API requests', async () => {
    routeFetch({ domains: domainResponse('unverified', 'unverified') });
    const mod = await load();

    await mod.registerSendingDomain('ogabassey.com');

    for (const [, init] of fetchMock.mock.calls) {
      expect((init as RequestInit).signal).toBeInstanceOf(AbortSignal);
    }
  });

  it('getSendingDomain reports verified only when DKIM and CNAME both pass', async () => {
    routeFetch({ domains: domainResponse('verified', 'verified') });
    const mod = await load();
    await expect(mod.getSendingDomain('dk1')).resolves.toMatchObject({
      verified: true,
    });

    routeFetch({ domains: domainResponse('verified', 'unverified') });
    const mod2 = await load();
    await expect(mod2.getSendingDomain('dk1')).resolves.toMatchObject({
      verified: false,
    });
  });

  it('findSendingDomainByName returns the matching listed domain', async () => {
    routeFetch({ domains: domainResponse('verified', 'verified') });
    const mod = await load();

    await expect(
      mod.findSendingDomainByName('OGABASSEY.COM')
    ).resolves.toMatchObject({
      domainKey: 'dk1',
      verified: true,
    });
    expect(
      fetchMock.mock.calls.some((call) => String(call[0]).endsWith('/domains'))
    ).toBe(true);
    expect(
      fetchMock.mock.calls.some((call) =>
        String(call[0]).endsWith('/domains/dk1')
      )
    ).toBe(true);
  });

  it('marks failed DNS checks as failed', async () => {
    routeFetch({ domains: domainResponse('failed', 'unverified') });
    const mod = await load();

    await expect(mod.getSendingDomain('dk1')).resolves.toMatchObject({
      status: 'failed',
      verified: false,
    });
  });

  it('verifySendingDomain asks ZeptoMail to validate DNS records', async () => {
    routeFetch({ domains: domainResponse('verified', 'verified') });
    const mod = await load();

    await expect(mod.verifySendingDomain('dk1')).resolves.toMatchObject({
      verified: true,
    });
    const verifyCall = fetchMock.mock.calls.find((call) =>
      String(call[0]).endsWith('/domains/dk1/verify')
    );
    expect((verifyCall?.[1] as RequestInit).method).toBe('PUT');
  });

  it('throws a useful error when the ZeptoMail API rejects', async () => {
    routeFetch({
      domains: {
        ok: false,
        status: 400,
        json: () => Promise.resolve({ message: 'Domain already exists' }),
      },
    });
    const mod = await load();
    await expect(mod.registerSendingDomain('x.com')).rejects.toThrow(
      'Domain already exists'
    );
  });

  it('throws when credentials are missing', async () => {
    vi.stubEnv('ZOHO_CLIENT_ID', '');
    const mod = await load();
    await expect(mod.registerSendingDomain('x.com')).rejects.toThrow(
      'not configured'
    );
  });
});
