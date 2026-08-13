import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createStorefrontEdgeInventoryFixture } from './storefront-edge-inventory.test-support';
import { STOREFRONT_EDGE_INVENTORY_POLICY } from './storefront-edge-inventory-policy';
import { readStorefrontEdgeSourceAuthority } from './storefront-edge-source-authority';

const temporaryRoots: string[] = [];
const routeRoot = 'apps/web/src/app/(storefront)/[slug]';
const apiRoot = 'apps/web/src/app/api';

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true }))
  );
});

describe('readStorefrontEdgeSourceAuthority', () => {
  it('rejects an option-shaped revision before invoking Git', async () => {
    // Arrange
    let caught: unknown;

    // Act
    try {
      await readStorefrontEdgeSourceAuthority({
        apiRoot,
        originMainSha: '--help',
        repoRoot: '/path/that/does/not/exist',
        routeRoot,
        routingInputPaths: STOREFRONT_EDGE_INVENTORY_POLICY.routingInputPaths,
      });
    } catch (error) {
      caught = error;
    }

    // Assert
    expect(caught).toBeInstanceOf(Error);
    expect(caught).toMatchObject({
      message: 'source tree does not match the approved commit',
    });
    expect(caught).not.toHaveProperty('cause');
  });

  it('returns approved route and routing-input bytes from the same commit', async () => {
    // Arrange
    const repoRoot = await mkdtemp(join(tmpdir(), 'edge-authority-'));
    temporaryRoots.push(repoRoot);
    const originMainSha = await createStorefrontEdgeInventoryFixture(repoRoot);
    // Act
    const snapshot = await readStorefrontEdgeSourceAuthority({
      apiRoot,
      originMainSha,
      repoRoot,
      routeRoot,
      routingInputPaths: STOREFRONT_EDGE_INVENTORY_POLICY.routingInputPaths,
    });

    // Assert
    expect(snapshot.apiSources.map(({ sourcePath }) => sourcePath)).toEqual([
      'apps/web/src/app/api/events/route.ts',
      'apps/web/src/app/api/orders/[id]/route.ts',
      'apps/web/src/app/api/orders/route.ts',
    ]);
    expect(snapshot.routeSources).toHaveLength(80);
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
        apiRoot,
        originMainSha,
        repoRoot,
        routeRoot,
        routingInputPaths: STOREFRONT_EDGE_INVENTORY_POLICY.routingInputPaths,
      })
    ).rejects.toThrow('source tree does not match the approved commit');
  });
});
