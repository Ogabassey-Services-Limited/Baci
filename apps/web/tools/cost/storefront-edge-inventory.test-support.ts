import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { STOREFRONT_EDGE_INVENTORY_POLICY } from './storefront-edge-inventory-policy';

const ROUTES = [
  '(home)/page.tsx',
  '(blog)/blog/[...catchAll]/route.ts',
  '(catalog)/(listing)/products/page.tsx',
  '(catalog)/(listing)/search/page.tsx',
  '(commerce)/checkout/page.tsx',
  '(content)/about/page.tsx',
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
        : 'export default function Page() { return null; }\n'
    );
  }
  for (const input of STOREFRONT_EDGE_INVENTORY_POLICY.routingInputPaths) {
    const path = join(repoRoot, input);
    await mkdir(join(path, '..'), { recursive: true });
    await writeFile(path, `// ${input}\n`);
  }
}
