import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createStorefrontEdgeInventoryFixture } from './storefront-edge-inventory.test-support';
import { STOREFRONT_EDGE_INVENTORY_POLICY } from './storefront-edge-inventory-policy';
import { readStorefrontEdgeSourceAuthority } from './storefront-edge-source-authority';

const temporaryRoots: string[] = [];
const routeRoot = 'apps/web/src/app/(storefront)/[slug]';

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true }))
  );
});

describe('readStorefrontEdgeSourceAuthority', () => {
  it('returns approved route and routing-input bytes from the same commit', async () => {
    // Arrange
    const repoRoot = await mkdtemp(join(tmpdir(), 'edge-authority-'));
    temporaryRoots.push(repoRoot);
    const originMainSha = await createStorefrontEdgeInventoryFixture(repoRoot);
    // Act
    const snapshot = await readStorefrontEdgeSourceAuthority({
      originMainSha,
      repoRoot,
      routeRoot,
      routingInputPaths: STOREFRONT_EDGE_INVENTORY_POLICY.routingInputPaths,
    });

    // Assert
    expect(snapshot.routeSources).toHaveLength(11);
    expect(snapshot.routingInputSources).toHaveLength(
      STOREFRONT_EDGE_INVENTORY_POLICY.routingInputPaths.length
    );
  });

  it('rejects changed routing-input bytes', async () => {
    // Arrange
    const repoRoot = await mkdtemp(join(tmpdir(), 'edge-authority-drift-'));
    temporaryRoots.push(repoRoot);
    const originMainSha = await createStorefrontEdgeInventoryFixture(repoRoot);
    await writeFile(
      join(repoRoot, 'apps/web/src/proxy.ts'),
      '// unapproved change\n'
    );

    // Act and assert
    await expect(
      readStorefrontEdgeSourceAuthority({
        originMainSha,
        repoRoot,
        routeRoot,
        routingInputPaths: STOREFRONT_EDGE_INVENTORY_POLICY.routingInputPaths,
      })
    ).rejects.toThrow('source tree does not match the approved commit');
  });
});
