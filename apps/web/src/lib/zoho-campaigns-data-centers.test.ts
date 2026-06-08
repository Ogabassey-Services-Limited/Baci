import { describe, expect, it } from 'vitest';
import { resolveZohoCampaignsDataCenterEndpoint } from './zoho-campaigns-data-centers';

describe('resolveZohoCampaignsDataCenterEndpoint', () => {
  it.each([
    [
      'https://campaigns.zoho.eu',
      'https://accounts.zoho.eu',
      'https://campaigns.zoho.eu/api/v1.1',
    ],
    [
      'https://www.zohoapis.in',
      'https://accounts.zoho.in',
      'https://campaigns.zoho.in/api/v1.1',
    ],
    [
      'https://accounts.zoho.com.au',
      'https://accounts.zoho.com.au',
      'https://campaigns.zoho.com.au/api/v1.1',
    ],
    [
      'https://campaigns.zoho.jp/api/v1.1',
      'https://accounts.zoho.jp',
      'https://campaigns.zoho.jp/api/v1.1',
    ],
  ])('maps %s to matching Campaigns and Accounts endpoints', (input, accountsServerUrl, apiRootUrl) => {
    expect(resolveZohoCampaignsDataCenterEndpoint(input)).toEqual({
      accountsServerUrl,
      apiRootUrl,
    });
  });

  it('normalizes mixed-case hosts and trailing slashes', () => {
    expect(
      resolveZohoCampaignsDataCenterEndpoint('https://CAMPAIGNS.ZOHO.EU/')
    ).toEqual({
      accountsServerUrl: 'https://accounts.zoho.eu',
      apiRootUrl: 'https://campaigns.zoho.eu/api/v1.1',
    });
  });

  it('returns undefined for empty and nullish inputs', () => {
    expect(resolveZohoCampaignsDataCenterEndpoint(null)).toBeUndefined();
    expect(resolveZohoCampaignsDataCenterEndpoint(undefined)).toBeUndefined();
    expect(resolveZohoCampaignsDataCenterEndpoint('   ')).toBeUndefined();
  });

  it('rejects credentials, query strings, and fragments', () => {
    expect(
      resolveZohoCampaignsDataCenterEndpoint(
        'https://user:pass@campaigns.zoho.eu'
      )
    ).toBeUndefined();
    expect(
      resolveZohoCampaignsDataCenterEndpoint(
        'https://campaigns.zoho.eu?region=eu'
      )
    ).toBeUndefined();
    expect(
      resolveZohoCampaignsDataCenterEndpoint(
        'https://campaigns.zoho.eu#fragment'
      )
    ).toBeUndefined();
  });

  it('rejects non-Zoho, non-HTTPS, and unexpected path values', () => {
    expect(
      resolveZohoCampaignsDataCenterEndpoint('https://example.com')
    ).toBeUndefined();
    expect(
      resolveZohoCampaignsDataCenterEndpoint('http://campaigns.zoho.eu')
    ).toBeUndefined();
    expect(
      resolveZohoCampaignsDataCenterEndpoint('https://campaigns.zoho.eu/other')
    ).toBeUndefined();
  });
});
