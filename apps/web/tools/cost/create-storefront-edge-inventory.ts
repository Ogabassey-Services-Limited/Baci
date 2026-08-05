import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { canonicalizeStorefrontEdgeInventoryValue } from './storefront-edge-canonical-json';
import { STOREFRONT_EDGE_INVENTORY_POLICY } from './storefront-edge-inventory-policy';
import type { StorefrontEdgeInventory } from './storefront-edge-inventory-types';

type InventoryRow = StorefrontEdgeInventory['rows'][number];
type CreateInventoryOptions = Readonly<{
  originMainSha: string;
  pilotCandidateHostnames: readonly string[];
  repoRoot: string;
}>;

const ROUTE_ROOT = 'apps/web/src/app/(storefront)/[slug]';
const HTTP_METHOD_ORDER = [
  'DELETE',
  'GET',
  'HEAD',
  'OPTIONS',
  'PATCH',
  'POST',
  'PUT',
] as const;
const REDIRECT_ENTRYPOINTS = new Set([
  '(blog)/blog/[...catchAll]/route.ts',
  '(catalog)/(pdp)/product/[productSlug]/page.tsx',
  '(content)/pages/about/page.tsx',
  '(content)/pages/blog/page.tsx',
  '(content)/pages/contact/page.tsx',
  '(content)/pages/faq/page.tsx',
  '(content)/pages/privacy/page.tsx',
  '(content)/pages/terms/page.tsx',
  '(content)/privacy-policy/page.tsx',
  '(content)/terms-and-conditions/page.tsx',
  '(content)/terms-of-service/page.tsx',
  'favicon.ico/route.ts',
  'news-sitemap.xml/route.ts',
  'storefront/[legacySlug]/swap/route.ts',
]);

const sha256 = (value: string | Buffer) =>
  createHash('sha256').update(value).digest('hex');

async function listRouteEntrypoints(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths: string[] = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink())
      throw new Error('storefront route tree must not contain symbolic links');
    if (entry.isDirectory()) paths.push(...(await listRouteEntrypoints(path)));
    else if (
      entry.isFile() &&
      (entry.name === 'page.tsx' || entry.name === 'route.ts')
    )
      paths.push(path);
  }
  return paths.sort();
}

function normalizeRoutePattern(relativeSourcePath: string) {
  const segments = relativeSourcePath
    .split('/')
    .slice(0, -1)
    .filter((segment) => !(segment.startsWith('(') && segment.endsWith(')')))
    .map((segment) => {
      const catchAll = segment.match(/^\[\.\.\.([^\]]+)]$/);
      if (catchAll) return `{*${catchAll[1]}}`;
      const parameter = segment.match(/^\[([^\]]+)]$/);
      return parameter ? `{${parameter[1]}}` : segment;
    });
  return segments.length === 0 ? '/' : `/${segments.join('/')}`;
}

function routeMethods(sourcePath: string, source: string) {
  if (sourcePath.endsWith('/page.tsx')) return ['GET', 'HEAD'];
  const exported = new Set<string>();
  for (const method of HTTP_METHOD_ORDER) {
    const declaration = new RegExp(
      `export\\s+(?:(?:async\\s+)?function|const)\\s+${method}\\b`
    );
    if (declaration.test(source)) exported.add(method);
  }
  if (exported.has('GET')) exported.add('HEAD');
  const methods = HTTP_METHOD_ORDER.filter((method) => exported.has(method));
  if (methods.length === 0)
    throw new Error(
      `storefront route handler exports no HTTP method: ${sourcePath}`
    );
  return methods;
}

function classifyEntrypoint(
  relativeSourcePath: string
): Pick<InventoryRow, 'decision' | 'reason'> {
  if (REDIRECT_ENTRYPOINTS.has(relativeSourcePath))
    return {
      decision: 'edge_redirect',
      reason: 'redirect_only_storefront_entrypoint',
    };
  if (
    relativeSourcePath.startsWith('(commerce)/') ||
    relativeSourcePath.startsWith('(customer)/') ||
    relativeSourcePath.startsWith('(utility)/') ||
    relativeSourcePath === '(catalog)/(listing)/search/page.tsx' ||
    relativeSourcePath === '(content)/pages/rewards/page.tsx'
  )
    return {
      decision: 'origin_dynamic',
      reason: 'request_state_or_origin_action_required',
    };
  return { decision: 'edge_release', reason: 'public_release_surface' };
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

function hashedFiles(repoRoot: string, paths: readonly string[]) {
  return Promise.all(
    [...paths].sort().map(async (sourcePath) => ({
      sha256: sha256(await readFile(resolve(repoRoot, sourcePath))),
      sourcePath,
    }))
  );
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
  const routeRoot = resolve(repoRoot, ROUTE_ROOT);
  const entrypointPaths = await listRouteEntrypoints(routeRoot);
  const routeFiles = await Promise.all(
    entrypointPaths.map(async (path) => {
      const source = await readFile(path, 'utf8');
      const sourcePath = relative(repoRoot, path).split(sep).join('/');
      const relativeSourcePath = relative(routeRoot, path).split(sep).join('/');
      const classification = classifyEntrypoint(relativeSourcePath);
      return {
        row: {
          ...classification,
          id: `storefront:${relativeSourcePath}`,
          methods: routeMethods(sourcePath, source),
          routePattern: normalizeRoutePattern(relativeSourcePath),
          sourceKind: 'storefront_entrypoint' as const,
          sourcePath,
        },
        sha256: sha256(source),
        sourcePath,
      };
    })
  );
  const routeTreeSha256 = sha256(
    canonicalizeStorefrontEdgeInventoryValue(
      routeFiles.map(({ sha256: hash, sourcePath }) => ({
        sha256: hash,
        sourcePath,
      }))
    )
  );
  const routingProxyInputSha256 = sha256(
    canonicalizeStorefrontEdgeInventoryValue(
      await hashedFiles(
        repoRoot,
        STOREFRONT_EDGE_INVENTORY_POLICY.routingInputPaths
      )
    )
  );
  const rows = [
    ...routeFiles.map(({ row }) => row),
    ...STOREFRONT_EDGE_INVENTORY_POLICY.extraRows,
  ].sort((left, right) =>
    left.id < right.id ? -1 : left.id > right.id ? 1 : 0
  );
  if (new Set(rows.map(({ id }) => id)).size !== rows.length)
    throw new Error('storefront edge inventory contains duplicate row IDs');
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
  const pilotCandidateHostnames = values.get('--pilot-hostname') ?? [];
  if (
    !repoRoot ||
    !originMainSha ||
    !output ||
    pilotCandidateHostnames.length === 0
  )
    throw new Error(
      'inventory requires --repo-root, --source-sha, --output, and --pilot-hostname'
    );
  return {
    options: { originMainSha, pilotCandidateHostnames, repoRoot },
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
