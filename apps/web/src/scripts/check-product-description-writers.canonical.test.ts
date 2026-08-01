import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildProductDescriptionWriterInventoryCsv,
  checkProductDescriptionWriterInventory,
  type ProductDescriptionWriterInventoryRow,
} from './check-product-description-writers';

const fixtureRoots: string[] = [];
const writerPath = 'apps/web/src/app/api/products/writer.ts';
const testPath = 'apps/web/src/app/api/products/writer.test.ts';
const alternateTestPath = 'apps/web/src/app/api/products/alternate.test.ts';
const writerSource =
  "await supabase.from('products').insert({ description: input.description });\n";

async function writeFixture(root: string, path: string, content: string) {
  await mkdir(join(root, path, '..'), { recursive: true });
  await writeFile(join(root, path), content, 'utf8');
}

async function createFixture() {
  const root = await mkdtemp(join(tmpdir(), 'baci-description-writer-canonical-'));
  fixtureRoots.push(root);
  await Promise.all([
    writeFixture(root, writerPath, writerSource),
    writeFixture(root, testPath, ''),
    writeFixture(root, alternateTestPath, ''),
  ]);

  const rows: ProductDescriptionWriterInventoryRow[] = [
    {
      inventory_version: '1',
      path: writerPath,
      caller_or_route: 'fixture route',
      operation: 'insert public.products.description',
      description_input_contract: 'fixture input',
      can_attest_source: 'no',
      unattested_source: 'unattested_pending_C2b',
      guard_error_contract:
        'C3 prepared guard not installed; stable error mapping pending',
      test_path: testPath,
      file_sha256: createHash('sha256').update(writerSource).digest('hex'),
    },
  ];

  return { root, rows };
}

afterEach(async () => {
  await Promise.all(
    fixtureRoots.splice(0).map((root) =>
      rm(root, { recursive: true, force: true })
    )
  );
});

describe('checkProductDescriptionWriterInventory canonical rows', () => {
  it.each([
    'caller_or_route',
    'operation',
    'description_input_contract',
    'test_path',
  ] as const)('rejects canonical %s drift', async (field) => {
    const { root, rows } = await createFixture();
    const changedRows = rows.map((row) => ({
      ...row,
      [field]: field === 'test_path' ? alternateTestPath : 'unreviewed drift',
    }));

    const result = await checkProductDescriptionWriterInventory({
      canonicalInventoryRows: rows,
      inventoryCsv: buildProductDescriptionWriterInventoryCsv(changedRows),
      repositoryRoot: root,
    });

    expect(result.errors).toContain(
      `Canonical inventory drift for ${writerPath}: ${field}`
    );
    expect(result.ok).toBe(false);
  });
});
