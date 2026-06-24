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
  fetchMock.mockImplementation((url: string) => {
    if (url.includes('accounts.zoho.com')) {
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

  it('isZeptomailDomainsConfigured reflects env presence', async () => {
    const mod = await load();
    expect(mod.isZeptomailDomainsConfigured()).toBe(true);
    vi.stubEnv('ZOHO_REFRESH_TOKEN', '');
    expect(mod.isZeptomailDomainsConfigured()).toBe(false);
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
