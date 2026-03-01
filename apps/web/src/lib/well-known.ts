import { APPLE_TEAM_ID, MOBILE_APPS } from '@/config/platform';

/** Which apps should be associated with a given domain */
export interface DomainAppConfig {
  includeStorefront: boolean;
  includeAdmin: boolean;
}

/**
 * Determine which apps to associate with a domain.
 *
 * Currently only ogabassey has native apps:
 * - Root platform domain → admin app
 * - Ogabassey's custom domain / subdomain → storefront app
 * - All other merchant domains → no apps (empty response)
 */
export function getAppConfigForDomain(
  hostname: string,
  rootDomain: string
): DomainAppConfig {
  const normalized = hostname.toLowerCase().replace(/^www\./, '');
  const normalizedRoot = rootDomain
    .toLowerCase()
    .trim()
    .replace(/^www\./, '');

  // Root platform domain: associate admin app only
  if (normalized === normalizedRoot) {
    return { includeStorefront: false, includeAdmin: true };
  }

  // Ogabassey's known domains: associate storefront app
  const ogabasseyDomains = new Set([
    'ogabassey.com',
    `ogabassey.${normalizedRoot}`,
  ]);

  if (ogabasseyDomains.has(normalized)) {
    return { includeStorefront: true, includeAdmin: false };
  }

  // All other merchant domains: no native app yet
  return { includeStorefront: false, includeAdmin: false };
}

/** Android Digital Asset Links statement */
interface AssetLinkStatement {
  relation: string[];
  target: {
    namespace: string;
    package_name: string;
    sha256_cert_fingerprints: string[];
  };
  relation_extensions?: {
    'delegate_permission/common.handle_all_urls': {
      dynamic_app_link_components: Record<string, unknown>[];
    };
  };
}

/**
 * Build Android assetlinks.json with Android 15+ relation_extensions.
 * Returns an empty array if no apps are associated with this domain.
 */
export function buildAssetLinks(config: DomainAppConfig): AssetLinkStatement[] {
  const statements: AssetLinkStatement[] = [];

  if (config.includeAdmin) {
    statements.push({
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: MOBILE_APPS.admin.androidPackage,
        sha256_cert_fingerprints: [
          ...MOBILE_APPS.admin.androidSha256Fingerprints,
        ],
      },
    });
  }

  if (config.includeStorefront) {
    statements.push({
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: MOBILE_APPS.storefront.androidPackage,
        sha256_cert_fingerprints: [
          ...MOBILE_APPS.storefront.androidSha256Fingerprints,
        ],
      },
      // Android 15+ dynamic app link components for path scoping
      relation_extensions: {
        'delegate_permission/common.handle_all_urls': {
          dynamic_app_link_components: [
            ...MOBILE_APPS.storefront.deepLinkPaths.map((p) => ({ '/': p })),
            { '/': '*', exclude: true },
          ],
        },
      },
    });
  }

  return statements;
}

/** Apple AASA detail entry (modern components format) */
interface AASADetail {
  appIDs: string[];
  components: Record<string, string>[];
}

/**
 * Build Apple App Site Association using the modern "components" format.
 * Returns a minimal `{ applinks: { details: [] } }` if no apps are associated.
 */
export function buildAASA(config: DomainAppConfig): {
  applinks: { details: AASADetail[] };
} {
  const details: AASADetail[] = [];

  if (config.includeStorefront && MOBILE_APPS.storefront.iosBundleId) {
    details.push({
      appIDs: [`${APPLE_TEAM_ID}.${MOBILE_APPS.storefront.iosBundleId}`],
      components: MOBILE_APPS.storefront.deepLinkPaths.map((p) => ({
        '/': p,
      })),
    });
  }

  if (config.includeAdmin && MOBILE_APPS.admin.iosBundleId) {
    details.push({
      appIDs: [`${APPLE_TEAM_ID}.${MOBILE_APPS.admin.iosBundleId}`],
      components: MOBILE_APPS.admin.deepLinkPaths.map((p) => ({ '/': p })),
    });
  }

  return { applinks: { details } };
}
