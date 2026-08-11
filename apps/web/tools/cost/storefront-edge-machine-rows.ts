import { STOREFRONT_AGENT_ROUTES } from '../../src/config/storefront-agent-routes';
import { STOREFRONT_FEED_ROUTES } from '../../src/config/storefront-feed-routes';
import type { StorefrontEdgeInventory } from './storefront-edge-inventory-types';
import { STOREFRONT_EDGE_MACHINE_SOURCE_PATHS } from './storefront-edge-machine-source-paths';

type InventoryRow = StorefrontEdgeInventory['rows'][number];
type InventoryMethod = InventoryRow['methods'][number];

const METHOD_ORDER: InventoryRow['methods'] = [
  'DELETE',
  'GET',
  'HEAD',
  'OPTIONS',
  'PATCH',
  'POST',
  'PUT',
];

const machineFamily = (
  id: string,
  routePattern: string,
  methods: InventoryRow['methods'],
  decision: InventoryRow['decision'] = 'origin_dynamic'
): InventoryRow => {
  const sourcePath = Object.entries(STOREFRONT_EDGE_MACHINE_SOURCE_PATHS).find(
    ([pattern]) => pattern === routePattern
  )?.[1];
  if (!sourcePath)
    throw new Error(`machine route source is not declared: ${routePattern}`);
  const effectiveMethods: InventoryRow['methods'] =
    (sourcePath.endsWith('/route.ts') ||
      routePattern === '/manifest.webmanifest' ||
      routePattern === '/robots.txt') &&
    !methods.includes('ANY')
      ? [...new Set<InventoryMethod>([...methods, 'OPTIONS'])].sort(
          (left, right) =>
            METHOD_ORDER.indexOf(left) - METHOD_ORDER.indexOf(right)
        )
      : methods;
  return {
    decision,
    id,
    methods: effectiveMethods,
    reason: 'explicit_storefront_machine_family',
    routePattern,
    sourceKind: 'machine_family',
    sourcePath,
  };
};

const WELL_KNOWN_ROWS: readonly InventoryRow[] = [
  machineFamily('machine:well-known-acp', STOREFRONT_AGENT_ROUTES.acpProfile, [
    'GET',
    'HEAD',
  ]),
  machineFamily('machine:well-known-agent-auth', '/.well-known/agent-auth', [
    'GET',
    'HEAD',
    'POST',
  ]),
  machineFamily(
    'machine:well-known-agent-auth-claim',
    '/.well-known/agent-auth/claim',
    ['GET', 'HEAD', 'POST']
  ),
  machineFamily(
    'machine:well-known-agent-auth-revoke',
    '/.well-known/agent-auth/revoke',
    ['GET', 'HEAD', 'POST']
  ),
  machineFamily(
    'machine:well-known-agent-native-commerce',
    STOREFRONT_AGENT_ROUTES.agentNativeCommerce,
    ['GET', 'HEAD']
  ),
  machineFamily(
    'machine:well-known-agent-skill-index',
    STOREFRONT_AGENT_ROUTES.agentSkillIndex,
    ['GET', 'HEAD']
  ),
  machineFamily(
    'machine:well-known-agent-skill-markdown',
    STOREFRONT_AGENT_ROUTES.agentSkillMarkdown,
    ['GET', 'HEAD']
  ),
  machineFamily(
    'machine:well-known-api-catalog',
    STOREFRONT_AGENT_ROUTES.apiCatalog,
    ['GET', 'HEAD']
  ),
  machineFamily(
    'machine:well-known-apple-app-site-association',
    '/.well-known/apple-app-site-association',
    ['GET', 'HEAD']
  ),
  machineFamily(
    'machine:well-known-assetlinks',
    '/.well-known/assetlinks.json',
    ['GET', 'HEAD']
  ),
  machineFamily(
    'machine:well-known-http-signatures',
    '/.well-known/http-message-signatures-directory',
    ['GET', 'HEAD']
  ),
  machineFamily('machine:well-known-llms', '/.well-known/llms.txt', [
    'GET',
    'HEAD',
  ]),
  machineFamily('machine:well-known-llms-full', '/.well-known/llms-full.txt', [
    'GET',
    'HEAD',
  ]),
  machineFamily(
    'machine:well-known-mcp-card',
    STOREFRONT_AGENT_ROUTES.mcpServerCard,
    ['GET', 'HEAD']
  ),
  machineFamily(
    'machine:well-known-oauth-authorization-server',
    '/.well-known/oauth-authorization-server',
    ['GET', 'HEAD']
  ),
  machineFamily(
    'machine:well-known-oauth-agent-auth-v1',
    '/.well-known/oauth-authorization-server/agent-auth/v1',
    ['GET', 'HEAD']
  ),
  machineFamily(
    'machine:well-known-oauth-protected-resource',
    '/.well-known/oauth-protected-resource',
    ['GET', 'HEAD']
  ),
  machineFamily(
    'machine:well-known-openid-configuration',
    '/.well-known/openid-configuration',
    ['GET', 'HEAD']
  ),
  machineFamily('machine:well-known-ucp', STOREFRONT_AGENT_ROUTES.ucpProfile, [
    'GET',
    'HEAD',
  ]),
  machineFamily(
    'machine:well-known-unlisted',
    '/.well-known/{*unlisted?}',
    ['ANY'],
    'edge_terminal'
  ),
];

const FEED_ROWS = Object.entries(STOREFRONT_FEED_ROUTES).map(
  ([name, routePattern]) =>
    machineFamily(`machine:feed-${name}`, routePattern, ['GET', 'HEAD'])
);

/** Closed machine-readable storefront surface used by the Task 1A inventory. */
export const STOREFRONT_EDGE_MACHINE_ROWS: readonly InventoryRow[] = [
  {
    decision: 'edge_redirect',
    id: 'proxy:retired-slug-machine-path',
    methods: ['GET', 'HEAD'],
    reason: 'retired_storefront_alias_redirect',
    routePattern: '/{*machinePath?}',
    sourceKind: 'proxy_path_class',
    sourcePath: 'apps/web/src/proxy.ts',
    hostCondition: {
      hostKind: 'retired_platform_subdomain_alias',
      precedence: 'before_path_decision',
    },
    pathCondition: {
      firstSegmentNotIn: ['api'],
      precedence: 'before_path_decision',
      predicate: 'retired_alias_storefront_path',
    },
  },
  machineFamily(
    'machine:agent-auth-document',
    STOREFRONT_AGENT_ROUTES.authDoc,
    ['GET', 'HEAD']
  ),
  machineFamily(
    'machine:agent-commerce-manifest',
    STOREFRONT_AGENT_ROUTES.manifest,
    ['GET', 'HEAD']
  ),
  machineFamily('machine:agent-trust-document', STOREFRONT_AGENT_ROUTES.trust, [
    'GET',
    'HEAD',
  ]),
  ...FEED_ROWS,
  machineFamily('machine:next-image', '/_next/image', ['ANY'], 'edge_terminal'),
  machineFamily(
    'machine:vercel-insights-script',
    '/_vercel/insights/script.js',
    ['GET', 'HEAD'],
    'origin_dynamic'
  ),
  machineFamily(
    'machine:vercel-speed-insights-script',
    '/_vercel/speed-insights/script.js',
    ['GET', 'HEAD'],
    'origin_dynamic'
  ),
  {
    ...machineFamily('machine:next-static', '/_next/static/{*asset}', [
      'GET',
      'HEAD',
    ]),
    requestCondition: {
      pathMembership: 'current_origin_next_build_manifest',
      precedence: 'before_path_decision',
    },
  },
  machineFamily(
    'machine:next-unlisted',
    '/_next/{*unlisted?}',
    ['ANY'],
    'edge_terminal'
  ),
  {
    decision: 'edge_redirect',
    id: 'proxy:retired-slug-llms',
    methods: ['GET', 'HEAD'],
    reason: 'retired_storefront_alias_redirect',
    routePattern: '/llms.txt',
    sourceKind: 'proxy_path_class',
    sourcePath: 'apps/web/src/proxy.ts',
    hostCondition: {
      hostKind: 'retired_platform_subdomain_alias',
      precedence: 'before_path_decision',
    },
  },
  machineFamily('machine:llms', '/llms.txt', ['GET', 'HEAD']),
  machineFamily('machine:llms-full', '/llms-full.txt', ['GET', 'HEAD']),
  machineFamily(
    'machine:manifest',
    '/manifest.webmanifest',
    ['GET', 'HEAD'],
    'edge_release'
  ),
  machineFamily('machine:ads', '/ads.txt', ['GET', 'HEAD'], 'origin_dynamic'),
  machineFamily('machine:openapi', STOREFRONT_AGENT_ROUTES.openApi, [
    'GET',
    'HEAD',
  ]),
  {
    ...machineFamily(
      'machine:indexnow-key-root',
      '/0751d5c882ab3d7c013ecbfe9e624d71.txt',
      ['GET', 'HEAD'],
      'edge_release'
    ),
    hostCondition: {
      hostKind: 'platform_root_domain',
      precedence: 'before_path_decision',
    },
  },
  {
    ...machineFamily(
      'machine:indexnow-key-custom-domain',
      '/0751d5c882ab3d7c013ecbfe9e624d71.txt',
      ['GET', 'HEAD'],
      'edge_release'
    ),
    hostCondition: {
      hostKind: 'custom_domain',
      precedence: 'before_path_decision',
    },
  },
  {
    ...machineFamily(
      'machine:robots-platform-root-rewrite',
      '/robots.txt',
      ['GET', 'HEAD', 'OPTIONS'],
      'origin_dynamic'
    ),
    hostCondition: {
      hostKind: 'platform_root_domain',
      precedence: 'before_path_decision',
    },
  },
  machineFamily(
    'machine:robots',
    '/robots.txt',
    ['GET', 'HEAD'],
    'edge_release'
  ),
  ...WELL_KNOWN_ROWS,
];
