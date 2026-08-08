import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';
import task1aInventory from '../../../../docs/superpowers/evidence/storefront-edge/task-1a-inventory.json';
import { createStorefrontEdgeInventory } from './create-storefront-edge-inventory';
import { createStorefrontEdgeInventoryFixture } from './storefront-edge-inventory.test-support';

const temporaryRoots: string[] = [];
const FIXTURE_SOURCE_SHA = 'a'.repeat(40);
const execFileAsync = promisify(execFile);
const toolDirectory = dirname(fileURLToPath(import.meta.url));
const tsxCliPath = createRequire(import.meta.url).resolve('tsx/cli');

async function fixtureRoot() {
  const root = await mkdtemp(joinTemporaryRoot('storefront-edge-inventory-'));
  temporaryRoots.push(root);
  await createStorefrontEdgeInventoryFixture(root);
  return root;
}

function joinTemporaryRoot(name: string) {
  return resolve(tmpdir(), name);
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true }))
  );
});

describe('createStorefrontEdgeInventory', () => {
  it('creates the same canonical inventory regardless of hostname input order', async () => {
    // Arrange
    const repoRoot = await fixtureRoot();

    // Act
    const first = await createStorefrontEdgeInventory({
      repoRoot,
      originMainSha: FIXTURE_SOURCE_SHA.toUpperCase(),
      pilotCandidateHostnames: [' Shop.Example.com. ', 'pilot.usebaci.com'],
    });
    const second = await createStorefrontEdgeInventory({
      repoRoot,
      originMainSha: FIXTURE_SOURCE_SHA,
      pilotCandidateHostnames: ['pilot.usebaci.com', 'shop.example.com'],
    });

    // Assert
    expect(first).toEqual(second);
    expect(first.originMainSha).toBe(FIXTURE_SOURCE_SHA);
    expect(first.authority).toBe('directional_cost_screen_only');
    expect(first.pilotCandidateHostnames).toEqual([
      'pilot.usebaci.com',
      'shop.example.com',
    ]);
    expect(first.inventorySha256).toMatch(/^[a-f0-9]{64}$/);
    expect(first.routeTreeSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(first.routingProxyInputSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(first.pilotCandidateHostnameSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(first)).not.toMatch(/createdAt|updatedAt|timestamp/i);
  });

  it('classifies static, redirect, and dynamic storefront entrypoints in canonical order', async () => {
    // Arrange
    const repoRoot = await fixtureRoot();

    // Act
    const inventory = await createStorefrontEdgeInventory({
      repoRoot,
      originMainSha: FIXTURE_SOURCE_SHA,
      pilotCandidateHostnames: ['pilot.usebaci.com'],
    });
    const entrypoints = inventory.rows.filter(
      (row) => row.sourceKind === 'storefront_entrypoint'
    );

    // Assert
    expect(entrypoints).toHaveLength(6);
    expect(entrypoints.map((row) => row.id)).toEqual(
      [...entrypoints.map((row) => row.id)].sort()
    );
    expect(entrypoints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          routePattern: '/',
          decision: 'edge_release',
        }),
        expect.objectContaining({
          routePattern: '/blog/{*catchAll}',
          decision: 'edge_redirect',
          methods: ['GET', 'HEAD'],
        }),
        expect.objectContaining({
          routePattern: '/products',
          decision: 'edge_release',
        }),
        expect.objectContaining({
          routePattern: '/search',
          decision: 'origin_dynamic',
        }),
        expect.objectContaining({
          routePattern: '/checkout',
          decision: 'origin_dynamic',
        }),
      ])
    );
    expect(inventory.eligibleDenominatorPolicy).toEqual(
      expect.objectContaining({
        decisions: ['edge_redirect', 'edge_release'],
        methods: ['GET', 'HEAD'],
        zeroDenominatorVerdict: 'NOT_PROVEN',
      })
    );
    expect(inventory.completeBrowserPathClasses).toContain(
      'automatic_origin_forbidden'
    );
  });

  it('classifies every current storefront entrypoint without changing proxy.ts', async () => {
    // Arrange
    const repoRoot = resolve(
      dirname(fileURLToPath(import.meta.url)),
      '../../../..'
    );

    // Act
    const inventory = await createStorefrontEdgeInventory({
      repoRoot,
      originMainSha: FIXTURE_SOURCE_SHA,
      pilotCandidateHostnames: ['standard-pilot.invalid'],
    });
    const entrypoints = inventory.rows.filter(
      (row) => row.sourceKind === 'storefront_entrypoint'
    );
    const expectedSourcePaths = task1aInventory.rows
      .filter((row) => row.sourceKind === 'storefront_entrypoint')
      .map((row) => row.sourcePath);

    // Assert
    expect(entrypoints.length).toBeGreaterThan(0);
    expect(entrypoints.map((row) => row.sourcePath)).toEqual(
      expectedSourcePaths
    );
    expect(new Set(entrypoints.map((row) => row.sourcePath)).size).toBe(
      entrypoints.length
    );
    expect(
      entrypoints.find(
        (row) => row.routePattern === '/{category}/{productSlug}'
      )?.decision
    ).toBe('edge_release');
    expect(
      entrypoints.find((row) => row.routePattern === '/product/{productSlug}')
        ?.decision
    ).toBe('edge_redirect');
    expect(
      entrypoints.find((row) => row.routePattern === '/quiz')?.decision
    ).toBe('origin_dynamic');
    expect(
      entrypoints.find((row) => row.routePattern === '/pages/rewards')?.decision
    ).toBe('origin_dynamic');
  });

  it('inventories explicit proxy aliases and required runtime families before closed defaults', async () => {
    // Arrange
    const repoRoot = await fixtureRoot();

    // Act
    const inventory = await createStorefrontEdgeInventory({
      repoRoot,
      originMainSha: FIXTURE_SOURCE_SHA,
      pilotCandidateHostnames: ['pilot.usebaci.com'],
    });
    const rowIds = new Set(inventory.rows.map((row) => row.id));

    // Assert
    expect(inventory.rows.map((row) => row.id)).toEqual(
      [...inventory.rows.map((row) => row.id)].sort()
    );
    for (const requiredId of [
      'api:llm',
      'api:repairs',
      'api:unlisted',
      'machine:openapi',
      'machine:well-known',
      'proxy:blog-query-canonical',
      'proxy:cache-safe-punctuation',
      'proxy:legacy-analytics-conversion',
      'proxy:legacy-klump-webhook',
      'proxy:legacy-terms-alias',
      'proxy:lowercase-document',
      'proxy:retired-slug-api',
      'proxy:retired-slug-document',
      'proxy:root-sitemap',
      'proxy:unsupported-method',
    ]) {
      expect(rowIds, `missing ${requiredId}`).toContain(requiredId);
    }
  });

  it('rejects invalid source authority and candidate hostnames', async () => {
    // Arrange
    const repoRoot = await fixtureRoot();

    // Act and assert
    await expect(
      createStorefrontEdgeInventory({
        repoRoot,
        originMainSha: 'main',
        pilotCandidateHostnames: ['pilot.usebaci.com'],
      })
    ).rejects.toThrow('origin main SHA');
    await expect(
      createStorefrontEdgeInventory({
        repoRoot,
        originMainSha: FIXTURE_SOURCE_SHA,
        pilotCandidateHostnames: ['https://pilot.usebaci.com/path'],
      })
    ).rejects.toThrow('pilot candidate hostname');
  });

  it('creates and validates an artifact through the installed tsx runtime', async () => {
    // Arrange
    const repoRoot = await fixtureRoot();
    const output = join(repoRoot, 'task-1a-inventory.json');

    // Act
    const created = await execFileAsync(process.execPath, [
      tsxCliPath,
      join(toolDirectory, 'create-storefront-edge-inventory.ts'),
      '--repo-root',
      repoRoot,
      '--source-sha',
      FIXTURE_SOURCE_SHA,
      '--pilot-hostname',
      'pilot.usebaci.com',
      '--output',
      output,
    ]);
    const validated = await execFileAsync(process.execPath, [
      tsxCliPath,
      join(toolDirectory, 'validate-storefront-edge-inventory.ts'),
      '--repo-root',
      repoRoot,
      '--source-sha',
      FIXTURE_SOURCE_SHA,
      '--input',
      output,
    ]);

    // Assert
    expect(JSON.parse(created.stdout)).toEqual(
      expect.objectContaining({ rowCount: expect.any(Number) })
    );
    expect(JSON.parse(validated.stdout)).toEqual(
      expect.objectContaining({ storefrontEntrypointCount: 6 })
    );
  });

  it.each([
    ['unknown', ['--unexpected', 'value']],
    ['duplicate', ['--source-sha', FIXTURE_SOURCE_SHA]],
  ])('rejects %s generator options', async (_label, extraArguments) => {
    // Arrange
    const repoRoot = await fixtureRoot();
    const output = join(repoRoot, 'task-1a-inventory.json');

    // Act and assert
    await expect(
      execFileAsync(process.execPath, [
        tsxCliPath,
        join(toolDirectory, 'create-storefront-edge-inventory.ts'),
        '--repo-root',
        repoRoot,
        '--source-sha',
        FIXTURE_SOURCE_SHA,
        '--pilot-hostname',
        'pilot.usebaci.com',
        '--output',
        output,
        ...extraArguments,
      ])
    ).rejects.toThrow('inventory options are invalid');
  });
});
