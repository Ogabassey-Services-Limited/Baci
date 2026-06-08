export type ZohoCampaignsDataCenterEndpoint = {
  accountsServerUrl: string;
  apiRootUrl: string;
};

const ZOHO_CAMPAIGNS_API_VERSION_PATH = '/api/v1.1';

const DATA_CENTER_BY_DOMAIN = new Map([
  [
    '.com',
    {
      accountsServerUrl: 'https://accounts.zoho.com',
      apiRootUrl: 'https://campaigns.zoho.com/api/v1.1',
    },
  ],
  [
    '.eu',
    {
      accountsServerUrl: 'https://accounts.zoho.eu',
      apiRootUrl: 'https://campaigns.zoho.eu/api/v1.1',
    },
  ],
  [
    '.in',
    {
      accountsServerUrl: 'https://accounts.zoho.in',
      apiRootUrl: 'https://campaigns.zoho.in/api/v1.1',
    },
  ],
  [
    '.com.au',
    {
      accountsServerUrl: 'https://accounts.zoho.com.au',
      apiRootUrl: 'https://campaigns.zoho.com.au/api/v1.1',
    },
  ],
  [
    '.jp',
    {
      accountsServerUrl: 'https://accounts.zoho.jp',
      apiRootUrl: 'https://campaigns.zoho.jp/api/v1.1',
    },
  ],
  [
    '.com.cn',
    {
      accountsServerUrl: 'https://accounts.zoho.com.cn',
      apiRootUrl: 'https://campaigns.zoho.com.cn/api/v1.1',
    },
  ],
] satisfies readonly [string, ZohoCampaignsDataCenterEndpoint][]);

function isZohoDataCenterHost(host: string, prefix: string, domain: string) {
  return host === `${prefix}${domain}`;
}

function endpointForHost(host: string): ZohoCampaignsDataCenterEndpoint | null {
  for (const [domain, endpoint] of DATA_CENTER_BY_DOMAIN) {
    if (
      isZohoDataCenterHost(host, 'accounts.zoho', domain) ||
      isZohoDataCenterHost(host, 'campaigns.zoho', domain) ||
      isZohoDataCenterHost(host, 'www.zohoapis', domain)
    ) {
      return endpoint;
    }
  }

  return null;
}

function normalizeString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

export function resolveZohoCampaignsDataCenterEndpoint(
  value: unknown
): ZohoCampaignsDataCenterEndpoint | undefined {
  const rawValue = normalizeString(value);
  if (!rawValue) return undefined;

  let parsed: URL;
  try {
    parsed = new URL(rawValue);
  } catch {
    return undefined;
  }

  if (
    parsed.protocol !== 'https:' ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash
  ) {
    return undefined;
  }

  const endpoint = endpointForHost(parsed.hostname.toLowerCase());
  if (!endpoint) return undefined;

  const pathname = parsed.pathname.replace(/\/+$/, '');
  if (pathname && pathname !== ZOHO_CAMPAIGNS_API_VERSION_PATH) {
    return undefined;
  }

  return endpoint;
}
