import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { STOREFRONT_EDGE_INVENTORY_POLICY } from './storefront-edge-inventory-policy';
import { STOREFRONT_EDGE_REDIRECT_ENTRYPOINTS } from './storefront-edge-redirect-entrypoints';

const execFileAsync = promisify(execFile);

const ROUTES = [
  '(home)/page.tsx',
  '(blog)/blog/author/[authorSlug]/page.tsx',
  '(blog)/blog/category/[categorySlug]/page.tsx',
  '(blog)/blog/page.tsx',
  '(blog)/blog/[...catchAll]/route.ts',
  '(catalog)/(listing)/[category]/compare/page.tsx',
  '(catalog)/(listing)/[category]/page.tsx',
  '(catalog)/(listing)/compare/page.tsx',
  '(catalog)/(listing)/products/page.tsx',
  '(catalog)/(listing)/search/page.tsx',
  '(catalog)/(pdp)/[category]/[productSlug]/page.tsx',
  '(catalog)/(pdp)/products/[productSlug]/page.tsx',
  '(commerce)/checkout/page.tsx',
  '(content)/about/page.tsx',
  '(blog)/blog/sitemap.ts',
  'opengraph-image.tsx',
  ...STOREFRONT_EDGE_REDIRECT_ENTRYPOINTS,
] as const;

export async function createStorefrontEdgeInventoryFixture(repoRoot: string) {
  const routeRoot = join(repoRoot, 'apps/web/src/app/(storefront)/[slug]');
  for (const route of ROUTES) {
    const path = join(routeRoot, route);
    await mkdir(join(path, '..'), { recursive: true });
    await writeFile(
      path,
      route.endsWith('route.ts')
        ? 'export async function GET() {}\nexport const HEAD = GET;\n'
        : route.endsWith('sitemap.ts')
          ? 'export default async function sitemap() { return []; }\n'
          : route.endsWith('opengraph-image.tsx')
            ? 'export default async function Image() { return null; }\n'
            : 'export default function Page() { return null; }\n'
    );
  }
  const blogPostRoot = join(routeRoot, '(blog)/blog/[postSlug]');
  await mkdir(blogPostRoot, { recursive: true });
  await writeFile(
    join(blogPostRoot, 'layout.tsx'),
    'export default function Layout({ children }) { return children; }\n'
  );
  await writeFile(
    join(blogPostRoot, 'actions.ts'),
    "'use server';\nexport async function incrementViewCount() {}\n"
  );
  await writeFile(
    join(blogPostRoot, 'view-counter.tsx'),
    "'use client';\nexport function ViewCounter() { return null; }\n"
  );
  for (const input of STOREFRONT_EDGE_INVENTORY_POLICY.routingInputPaths) {
    const path = join(repoRoot, input);
    await mkdir(join(path, '..'), { recursive: true });
    await writeFile(path, `// ${input}\n`);
  }
  const apiRoot = join(repoRoot, 'apps/web/src/app/api');
  const apiRoutes = [
    {
      path: 'events/route.ts',
      source: 'export async function POST() {}\n',
    },
    {
      path: 'orders/[id]/route.ts',
      source:
        'export async function GET() {}\nexport async function PATCH() {}\n',
    },
  ];
  for (const route of apiRoutes) {
    const path = join(apiRoot, route.path);
    await mkdir(join(path, '..'), { recursive: true });
    await writeFile(path, route.source);
  }
  await execFileAsync('git', ['-C', repoRoot, 'init', '--quiet']);
  await execFileAsync('git', [
    '-C',
    repoRoot,
    '-c',
    'user.name=Inventory Test',
    '-c',
    'user.email=inventory@example.invalid',
    'add',
    '.',
  ]);
  await execFileAsync('git', [
    '-C',
    repoRoot,
    '-c',
    'user.name=Inventory Test',
    '-c',
    'user.email=inventory@example.invalid',
    'commit',
    '--quiet',
    '-m',
    'fixture',
  ]);
  const { stdout } = await execFileAsync('git', [
    '-C',
    repoRoot,
    'rev-parse',
    'HEAD',
  ]);
  return stdout.trim();
}
