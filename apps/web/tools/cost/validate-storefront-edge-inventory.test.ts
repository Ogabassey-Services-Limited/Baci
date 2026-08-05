import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';
import { createStorefrontEdgeInventory } from './create-storefront-edge-inventory';
import { createStorefrontEdgeInventoryFixture } from './storefront-edge-inventory.test-support';
import { validateStorefrontEdgeInventory } from './validate-storefront-edge-inventory';

const temporaryRoots: string[] = [];
const FIXTURE_SOURCE_SHA = 'a'.repeat(40);
const execFileAsync = promisify(execFile);
const toolDirectory = dirname(fileURLToPath(import.meta.url));
const tsxCliPath = createRequire(import.meta.url).resolve('tsx/cli');

async function arrangeInventory() {
  const repoRoot = await mkdtemp(join(tmpdir(), 'storefront-edge-validation-'));
  temporaryRoots.push(repoRoot);
  await createStorefrontEdgeInventoryFixture(repoRoot);
  const artifact = await createStorefrontEdgeInventory({
    repoRoot,
    originMainSha: FIXTURE_SOURCE_SHA,
    pilotCandidateHostnames: ['pilot.usebaci.com'],
  });
  const inputPath = join(repoRoot, 'task-1a-inventory.json');
  await writeFile(inputPath, `${JSON.stringify(artifact, null, 2)}\n`);
  return { artifact, inputPath, repoRoot };
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true }))
  );
});

describe('validateStorefrontEdgeInventory', () => {
  it('accepts an exact artifact regenerated from the checked-out tree', async () => {
    // Arrange
    const { artifact, inputPath, repoRoot } = await arrangeInventory();

    // Act
    const result = await validateStorefrontEdgeInventory({
      repoRoot,
      inputPath,
      expectedOriginMainSha: FIXTURE_SOURCE_SHA,
    });

    // Assert
    expect(result).toEqual({
      inventorySha256: artifact.inventorySha256,
      rowCount: artifact.rows.length,
      storefrontEntrypointCount: 6,
    });
  });

  it.each([
    [
      'origin authority',
      'inventory origin authority does not match origin/main',
      (value: Record<string, unknown>) => {
        value.originMainSha = 'b'.repeat(40);
      },
    ],
    [
      'hostname digest',
      'inventory artifact does not match the canonical source tree',
      (value: Record<string, unknown>) => {
        value.pilotCandidateHostnameSha256 = 'b'.repeat(64);
      },
    ],
    [
      'row order',
      'inventory artifact does not match the canonical source tree',
      (value: Record<string, unknown>) => {
        value.rows = [...(value.rows as unknown[])].reverse();
      },
    ],
    [
      'denominator policy',
      'inventory artifact does not match the canonical source tree',
      (value: Record<string, unknown>) => {
        value.eligibleDenominatorPolicy = {
          ...(value.eligibleDenominatorPolicy as Record<string, unknown>),
          methods: ['GET'],
        };
      },
    ],
    [
      'self hash',
      'inventory artifact does not match the canonical source tree',
      (value: Record<string, unknown>) => {
        value.inventorySha256 = 'b'.repeat(64);
      },
    ],
  ])('rejects a tampered %s', async (_label, message, tamper) => {
    // Arrange
    const { artifact, inputPath, repoRoot } = await arrangeInventory();
    const tampered = structuredClone(artifact) as unknown as Record<
      string,
      unknown
    >;
    tamper(tampered);
    await writeFile(inputPath, `${JSON.stringify(tampered, null, 2)}\n`);

    // Act and assert
    await expect(
      validateStorefrontEdgeInventory({
        repoRoot,
        inputPath,
        expectedOriginMainSha: FIXTURE_SOURCE_SHA,
      })
    ).rejects.toThrow(message);
  });

  it('rejects route-tree drift after the artifact was generated', async () => {
    // Arrange
    const { inputPath, repoRoot } = await arrangeInventory();
    const newRoute = join(
      repoRoot,
      'apps/web/src/app/(storefront)/[slug]/(content)/new/page.tsx'
    );
    await mkdir(dirname(newRoute), { recursive: true });
    await writeFile(
      newRoute,
      'export default function Page() { return null; }\n'
    );

    // Act and assert
    await expect(
      validateStorefrontEdgeInventory({
        repoRoot,
        inputPath,
        expectedOriginMainSha: FIXTURE_SOURCE_SHA,
      })
    ).rejects.toThrow('inventory');
  });

  it('rejects routing and proxy input drift after the artifact was generated', async () => {
    // Arrange
    const { inputPath, repoRoot } = await arrangeInventory();
    await writeFile(
      join(repoRoot, 'apps/web/src/proxy.ts'),
      '// changed routing authority\n'
    );

    // Act and assert
    await expect(
      validateStorefrontEdgeInventory({
        repoRoot,
        inputPath,
        expectedOriginMainSha: FIXTURE_SOURCE_SHA,
      })
    ).rejects.toThrow('inventory');
  });

  it('rejects a non-string pilot hostname before regeneration', async () => {
    // Arrange
    const { artifact, inputPath, repoRoot } = await arrangeInventory();
    const malformed = {
      ...artifact,
      pilotCandidateHostnames: [123],
    };
    await writeFile(inputPath, `${JSON.stringify(malformed, null, 2)}\n`);

    // Act and assert
    await expect(
      validateStorefrontEdgeInventory({
        repoRoot,
        inputPath,
        expectedOriginMainSha: FIXTURE_SOURCE_SHA,
      })
    ).rejects.toThrow('inventory input has an invalid shape');
  });

  it('rejects unknown validator options', async () => {
    // Arrange
    const { inputPath, repoRoot } = await arrangeInventory();

    // Act and assert
    await expect(
      execFileAsync(process.execPath, [
        tsxCliPath,
        join(toolDirectory, 'validate-storefront-edge-inventory.ts'),
        '--repo-root',
        repoRoot,
        '--source-sha',
        FIXTURE_SOURCE_SHA,
        '--input',
        inputPath,
        '--unexpected',
        'value',
      ])
    ).rejects.toThrow('inventory validation options are invalid');
  });
});
