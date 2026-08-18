import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createStorefrontEdgeApiRows } from './create-storefront-edge-api-rows';
import { createStorefrontEdgeEntrypointRows } from './create-storefront-edge-entrypoint-rows';
import { isStorefrontRequiredApiSourcePath } from './storefront-edge-api-source-allowlist';
import { canonicalizeStorefrontEdgeInventoryValue } from './storefront-edge-canonical-json';
import { STOREFRONT_EDGE_INVENTORY_POLICY } from './storefront-edge-inventory-policy';
import type { StorefrontEdgeInventory } from './storefront-edge-inventory-types';
import { createStorefrontEdgePosthogRelayRows } from './storefront-edge-posthog-relay-rows';
import { readStorefrontEdgeSourceAuthority } from './storefront-edge-source-authority';

type CreateInventoryOptions = Readonly<{
  originMainSha: string;
  pilotCandidateHostnames: readonly string[];
  posthogRelayPath?: string;
  repoRoot: string;
}>;

type InventoryRow = StorefrontEdgeInventory['rows'][number];

const ROUTE_ROOTS = [
  'apps/web/src/app/(storefront)/[slug]',
  'apps/web/src/app/(storefront)/ogabassey',
] as const;
const ROUTE_ROOT = ROUTE_ROOTS[0];
const API_ROOT = 'apps/web/src/app/api';

const sha256 = (value: string | Buffer) =>
  createHash('sha256').update(value).digest('hex');

function routeSpecificity(row: InventoryRow) {
  const segments = row.routePattern.split('/').filter(Boolean);
  return segments.reduce(
    (score, segment, index) =>
      score +
      (segment.startsWith('{*') ? 0 : segment.startsWith('{') ? 10 : 20) *
        10 ** Math.max(0, 4 - index),
    segments.length * 100
  );
}

function isPreRouteRow(row: InventoryRow) {
  return Boolean(
    row.hostCondition ||
      row.pathCondition ||
      row.destinationCondition ||
      row.requestCondition?.precedence === 'before_path_decision'
  );
}

function normalizeHostnames(hostnames: readonly string[]) {
  const normalized = hostnames.map((hostname) => {
    const value = hostname.trim().toLowerCase().replace(/\.$/, '');
    const valid =
      value.length <= 253 &&
      value.includes('.') &&
      value
        .split('.')
        .every(
          (label) =>
            label.length > 0 &&
            label.length <= 63 &&
            /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)
        );
    if (!valid)
      throw new Error(`invalid pilot candidate hostname: ${hostname}`);
    return value;
  });
  const unique = [...new Set(normalized)].sort();
  if (unique.length === 0)
    throw new Error('pilot candidate hostname is required');
  return unique;
}

/** Regenerates the canonical, provider-independent Task 1A route inventory. */
export async function createStorefrontEdgeInventory(
  options: CreateInventoryOptions
): Promise<StorefrontEdgeInventory> {
  const originMainSha = options.originMainSha.trim().toLowerCase();
  if (!/^[a-f0-9]{40}$/.test(originMainSha))
    throw new Error('origin main SHA must be an exact 40-character Git SHA');
  const repoRoot = resolve(options.repoRoot);
  const pilotCandidateHostnames = normalizeHostnames(
    options.pilotCandidateHostnames
  );
  const relayRows = createStorefrontEdgePosthogRelayRows(
    options.posthogRelayPath ?? '/baci-relay'
  );
  const extraRows = STOREFRONT_EDGE_INVENTORY_POLICY.extraRows;
  const { apiSources, routeSources, routingInputSources } =
    await readStorefrontEdgeSourceAuthority({
      apiRoot: API_ROOT,
      originMainSha,
      repoRoot,
      routeRoots: [...ROUTE_ROOTS],
      routingInputPaths: STOREFRONT_EDGE_INVENTORY_POLICY.routingInputPaths,
    });
  const entrypointRows = createStorefrontEdgeEntrypointRows(
    ROUTE_ROOT,
    routeSources.filter(({ sourcePath }) =>
      sourcePath.startsWith(`${ROUTE_ROOT}/`)
    )
  );
  const apiRows = createStorefrontEdgeApiRows(
    API_ROOT,
    apiSources.filter(({ sourcePath }) =>
      isStorefrontRequiredApiSourcePath(sourcePath)
    )
  );
  const verifiedSourcePaths = new Set(
    [...apiSources, ...routeSources, ...routingInputSources].map(
      ({ sourcePath }) => sourcePath
    )
  );
  for (const row of extraRows) {
    if (row.sourcePath && !verifiedSourcePaths.has(row.sourcePath))
      throw new Error(
        `policy row source path is not part of the approved source set: ${row.id}`
      );
  }
  const routeTreeSha256 = sha256(
    canonicalizeStorefrontEdgeInventoryValue(
      routeSources.map(({ bytes, sourcePath }) => ({
        sha256: sha256(bytes),
        sourcePath,
      }))
    )
  );
  const routingProxyInputSha256 = sha256(
    canonicalizeStorefrontEdgeInventoryValue(
      routingInputSources
        .map(({ bytes, sourcePath }) => ({
          sha256: sha256(bytes),
          sourcePath,
        }))
        .concat(
          apiSources.map(({ bytes, sourcePath }) => ({
            sha256: sha256(bytes),
            sourcePath,
          }))
        )
    )
  );
  const PROXY_CANONICALIZATION_ROW_IDS = new Set(['proxy:no-trailing-slash']);
  const preRouteRows = extraRows.filter(
    (row) => row.sourceKind !== 'storefront_entrypoint' && isPreRouteRow(row)
  );
  const proxyCanonicalizationRows = preRouteRows.filter((row) =>
    PROXY_CANONICALIZATION_ROW_IDS.has(row.id)
  );
  const preRouteRowsAfterCanonicalization = preRouteRows.filter(
    (row) => !PROXY_CANONICALIZATION_ROW_IDS.has(row.id)
  );
  const routeRows = [
    ...extraRows.filter(
      (row) =>
        row.sourceKind !== 'storefront_entrypoint' &&
        !isPreRouteRow(row) &&
        (row.decision !== 'edge_terminal' ||
          row.sourceKind === 'machine_family')
    ),
    ...entrypointRows,
  ].sort((left, right) => {
    const specificityDelta = routeSpecificity(right) - routeSpecificity(left);
    if (specificityDelta !== 0) return specificityDelta;
    const leftHost =
      'hostCondition' in left &&
      left.hostCondition?.hostKind === 'platform_root_domain'
        ? 1
        : 0;
    const rightHost =
      'hostCondition' in right &&
      right.hostCondition?.hostKind === 'platform_root_domain'
        ? 1
        : 0;
    return rightHost - leftHost || left.id.localeCompare(right.id);
  });
  const terminalRows = extraRows.filter(
    (row) =>
      row.sourceKind !== 'storefront_entrypoint' &&
      row.decision === 'edge_terminal' &&
      !isPreRouteRow(row) &&
      row.sourceKind !== 'machine_family'
  );
  // Preserve API terminal placement: exact API rows must be followed by the
  // closed API default before unrelated storefront route phases begin.
  const rows = [
    ...proxyCanonicalizationRows,
    ...apiRows,
    STOREFRONT_EDGE_INVENTORY_POLICY.apiTerminalRow,
    ...relayRows,
    ...preRouteRowsAfterCanonicalization,
    ...routeRows,
    ...terminalRows,
  ];
  const duplicateIds = rows
    .map(({ id }) => id)
    .filter((id, index, all) => all.indexOf(id) !== index);
  if (duplicateIds.length > 0)
    throw new Error(
      `storefront edge inventory contains duplicate row IDs: ${[...new Set(duplicateIds)].join(', ')}`
    );
  const payload = {
    authority: 'directional_cost_screen_only',
    completeBrowserPathClasses:
      STOREFRONT_EDGE_INVENTORY_POLICY.completeBrowserPathClasses,
    eligibleDenominatorPolicy:
      STOREFRONT_EDGE_INVENTORY_POLICY.eligibleDenominatorPolicy,
    originMainSha,
    pilotCandidateHostnameSha256: sha256(
      canonicalizeStorefrontEdgeInventoryValue(pilotCandidateHostnames)
    ),
    pilotCandidateHostnames,
    routeTreeSha256,
    routingProxyInputSha256,
    rows,
    schemaVersion: STOREFRONT_EDGE_INVENTORY_POLICY.schemaVersion,
  } satisfies Omit<StorefrontEdgeInventory, 'inventorySha256'>;
  return {
    ...payload,
    inventorySha256: sha256(canonicalizeStorefrontEdgeInventoryValue(payload)),
  };
}

function parseArguments(args: readonly string[]) {
  const allowedOptions = new Set([
    '--output',
    '--pilot-hostname',
    '--posthog-relay-path',
    '--repo-root',
    '--source-sha',
  ]);
  const values = new Map<string, string[]>();
  for (let index = 0; index < args.length; index += 2) {
    const option = args[index];
    const value = args[index + 1];
    if (
      !option ||
      !allowedOptions.has(option) ||
      !value ||
      (option !== '--pilot-hostname' && values.has(option))
    )
      throw new Error('inventory options are invalid');
    values.set(option, [...(values.get(option) ?? []), value]);
  }
  const repoRoot = values.get('--repo-root')?.[0];
  const originMainSha = values.get('--source-sha')?.[0];
  const output = values.get('--output')?.[0];
  const posthogRelayPath = values.get('--posthog-relay-path')?.[0];
  const pilotCandidateHostnames = values.get('--pilot-hostname') ?? [];
  if (
    !repoRoot ||
    !originMainSha ||
    !output ||
    !posthogRelayPath ||
    pilotCandidateHostnames.length === 0
  )
    throw new Error(
      'inventory requires --repo-root, --source-sha, --output, --pilot-hostname, and --posthog-relay-path'
    );
  return {
    options: {
      originMainSha,
      pilotCandidateHostnames,
      posthogRelayPath,
      repoRoot,
    },
    output,
  };
}

async function runCli(args: readonly string[]) {
  const { options, output } = parseArguments(args);
  const inventory = await createStorefrontEdgeInventory(options);
  await mkdir(dirname(resolve(output)), { recursive: true });
  await writeFile(resolve(output), `${JSON.stringify(inventory, null, 2)}\n`, {
    mode: 0o600,
  });
  process.stdout.write(
    `${JSON.stringify({ inventorySha256: inventory.inventorySha256, rowCount: inventory.rows.length })}\n`
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  runCli(process.argv.slice(2)).catch((error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? error.stack : String(error)}\n`
    );
    process.exitCode = 1;
  });
}
