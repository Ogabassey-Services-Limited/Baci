import { describe, expect, it } from 'vitest';

import {
  buildAASA,
  buildAssetLinks,
  type DomainAppConfig,
  getAppConfigForDomain,
} from './well-known';

const ROOT_DOMAIN = 'usebaci.com';

describe('getAppConfigForDomain', () => {
  it('returns admin app for root platform domain', () => {
    expect(getAppConfigForDomain('usebaci.com', ROOT_DOMAIN)).toEqual({
      includeStorefront: false,
      includeAdmin: true,
    });
  });

  it('returns admin app for www root domain', () => {
    expect(getAppConfigForDomain('www.usebaci.com', ROOT_DOMAIN)).toEqual({
      includeStorefront: false,
      includeAdmin: true,
    });
  });

  it('returns storefront app for ogabassey.com', () => {
    expect(getAppConfigForDomain('ogabassey.com', ROOT_DOMAIN)).toEqual({
      includeStorefront: true,
      includeAdmin: false,
    });
  });

  it('returns storefront app for ogabassey subdomain', () => {
    expect(getAppConfigForDomain('ogabassey.usebaci.com', ROOT_DOMAIN)).toEqual(
      {
        includeStorefront: true,
        includeAdmin: false,
      }
    );
  });

  it('returns no apps for unknown merchant domain', () => {
    expect(getAppConfigForDomain('somemerchant.com', ROOT_DOMAIN)).toEqual({
      includeStorefront: false,
      includeAdmin: false,
    });
  });

  it('returns no apps for unknown subdomain', () => {
    expect(
      getAppConfigForDomain('otherstore.usebaci.com', ROOT_DOMAIN)
    ).toEqual({
      includeStorefront: false,
      includeAdmin: false,
    });
  });

  it('normalizes www prefix on custom domains', () => {
    expect(getAppConfigForDomain('www.ogabassey.com', ROOT_DOMAIN)).toEqual({
      includeStorefront: true,
      includeAdmin: false,
    });
  });

  it('is case-insensitive', () => {
    expect(getAppConfigForDomain('OGABASSEY.COM', ROOT_DOMAIN)).toEqual({
      includeStorefront: true,
      includeAdmin: false,
    });
  });

  it('sanitizes newline-corrupted rootDomain (LF)', () => {
    const corrupted = 'usebaci.com\ny\n';
    expect(getAppConfigForDomain('usebaci.com', corrupted)).toEqual({
      includeStorefront: false,
      includeAdmin: true,
    });
    expect(getAppConfigForDomain('ogabassey.com', corrupted)).toEqual({
      includeStorefront: true,
      includeAdmin: false,
    });
    expect(getAppConfigForDomain('other.com', corrupted)).toEqual({
      includeStorefront: false,
      includeAdmin: false,
    });
  });

  it('sanitizes newline-corrupted rootDomain (CRLF)', () => {
    const corrupted = 'usebaci.com\r\ny\r\n';
    expect(getAppConfigForDomain('usebaci.com', corrupted)).toEqual({
      includeStorefront: false,
      includeAdmin: true,
    });
    expect(getAppConfigForDomain('ogabassey.usebaci.com', corrupted)).toEqual({
      includeStorefront: true,
      includeAdmin: false,
    });
  });
});

describe('buildAssetLinks', () => {
  const storefrontConfig: DomainAppConfig = {
    includeStorefront: true,
    includeAdmin: false,
  };
  const adminConfig: DomainAppConfig = {
    includeStorefront: false,
    includeAdmin: true,
  };
  const emptyConfig: DomainAppConfig = {
    includeStorefront: false,
    includeAdmin: false,
  };

  it('returns storefront entry for storefront config', () => {
    const result = buildAssetLinks(storefrontConfig);
    expect(result).toHaveLength(1);
    expect(result[0].target.namespace).toBe('android_app');
    expect(result[0].target.package_name).toBe('com.ogabassey.store');
  });

  it('includes relation_extensions for storefront (Android 15+)', () => {
    const result = buildAssetLinks(storefrontConfig);
    expect(result[0].relation_extensions).toBeDefined();
    const components =
      result[0].relation_extensions?.[
        'delegate_permission/common.handle_all_urls'
      ].dynamic_app_link_components;
    expect(components).toBeDefined();
    expect(components?.[components.length - 1]).toEqual({
      '/': '*',
      exclude: true,
    });
  });

  it('keeps unsupported blog and plural product paths out of storefront links', () => {
    const components =
      buildAssetLinks(storefrontConfig)[0].relation_extensions?.[
        'delegate_permission/common.handle_all_urls'
      ].dynamic_app_link_components;

    expect(components).not.toContainEqual({ '/': '/blog/*' });
    expect(components).not.toContainEqual({ '/': '/products/*' });
    expect(components).toContainEqual({ '/': '/product/*' });
  });

  it('returns admin entry without relation_extensions', () => {
    const result = buildAssetLinks(adminConfig);
    expect(result).toHaveLength(1);
    expect(result[0].target.package_name).toBe('com.ogabassey.baci');
    expect(result[0].relation_extensions).toBeUndefined();
  });

  it('includes credential sharing relation for admin app', () => {
    const result = buildAssetLinks(adminConfig);
    expect(result[0].relation).toContain(
      'delegate_permission/common.get_login_creds'
    );
  });

  it('returns empty array when no apps configured', () => {
    expect(buildAssetLinks(emptyConfig)).toEqual([]);
  });

  it('includes sha256 fingerprints', () => {
    const result = buildAssetLinks(storefrontConfig);
    expect(result[0].target.sha256_cert_fingerprints.length).toBeGreaterThan(0);
    expect(result[0].target.sha256_cert_fingerprints[0]).toMatch(
      /^[0-9A-F]{2}(:[0-9A-F]{2})+$/
    );
  });

  it('includes correct relation', () => {
    const result = buildAssetLinks(storefrontConfig);
    expect(result[0].relation).toEqual([
      'delegate_permission/common.handle_all_urls',
      'delegate_permission/common.get_login_creds',
    ]);
  });
});

describe('buildAASA', () => {
  const storefrontConfig: DomainAppConfig = {
    includeStorefront: true,
    includeAdmin: false,
  };
  const adminConfig: DomainAppConfig = {
    includeStorefront: false,
    includeAdmin: true,
  };
  const emptyConfig: DomainAppConfig = {
    includeStorefront: false,
    includeAdmin: false,
  };

  it('returns storefront details with components format', () => {
    const result = buildAASA(storefrontConfig);
    expect(result.applinks.details).toHaveLength(1);
    const detail = result.applinks.details[0];
    expect(detail.components).toBeDefined();
    expect(detail.components.length).toBeGreaterThan(0);
  });

  it('uses modern components format, not legacy paths', () => {
    const result = buildAASA(storefrontConfig);
    const detail = result.applinks.details[0];
    expect(detail).not.toHaveProperty('paths');
    expect(detail.components[0]).toHaveProperty('/');
  });

  it('keeps unsupported blog and plural product paths out of storefront links', () => {
    const components =
      buildAASA(storefrontConfig).applinks.details[0].components;

    expect(components).not.toContainEqual({ '/': '/blog/*' });
    expect(components).not.toContainEqual({ '/': '/products/*' });
    expect(components).toContainEqual({ '/': '/product/*' });
  });

  it('includes Apple Team ID in appIDs', () => {
    const result = buildAASA(storefrontConfig);
    const appIDs = result.applinks.details[0].appIDs;
    expect(appIDs[0]).toMatch(/^6QLNK7TXM3\./);
  });

  it('returns admin details for admin config', () => {
    const result = buildAASA(adminConfig);
    expect(result.applinks.details).toHaveLength(1);
    expect(result.applinks.details[0].appIDs[0]).toContain(
      'com.ogabassey.baci'
    );
  });

  it('returns empty details when no apps configured', () => {
    const result = buildAASA(emptyConfig);
    expect(result.applinks.details).toEqual([]);
  });

  it('always has applinks key', () => {
    expect(buildAASA(emptyConfig)).toHaveProperty('applinks');
    expect(buildAASA(storefrontConfig)).toHaveProperty('applinks');
  });
});
