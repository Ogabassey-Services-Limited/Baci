import { STOREFRONT_AGENT_ROUTES } from '../../src/config/storefront-agent-routes';
import { STOREFRONT_FEED_ROUTES } from '../../src/config/storefront-feed-routes';
import type { StorefrontEdgeInventory } from './storefront-edge-inventory-types';

type InventoryRow = StorefrontEdgeInventory['rows'][number];

const machineFamily = (
  id: string,
  routePattern: string,
  methods: readonly string[],
  decision: InventoryRow['decision'] = 'origin_dynamic'
): InventoryRow => ({
  decision,
  id,
  methods,
  reason: 'explicit_storefront_machine_family',
  routePattern,
  sourceKind: 'machine_family',
});

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
    '/.well-known/{*unlisted}',
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
  machineFamily('machine:next-image', '/_next/image', ['GET', 'HEAD']),
  machineFamily('machine:next-static', '/_next/static/{*asset}', [
    'GET',
    'HEAD',
  ]),
  machineFamily(
    'machine:next-unlisted',
    '/_next/{*unlisted}',
    ['ANY'],
    'edge_terminal'
  ),
  machineFamily('machine:posthog-relay', '/baci-relay/{*path}', [
    'GET',
    'HEAD',
    'POST',
  ]),
  machineFamily('machine:llms', '/llms.txt', ['GET', 'HEAD']),
  machineFamily('machine:llms-full', '/llms-full.txt', ['GET', 'HEAD']),
  machineFamily('machine:openapi', STOREFRONT_AGENT_ROUTES.openApi, [
    'GET',
    'HEAD',
  ]),
  machineFamily(
    'machine:robots',
    '/robots.txt',
    ['GET', 'HEAD'],
    'edge_release'
  ),
  ...WELL_KNOWN_ROWS,
];
