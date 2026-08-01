import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildProductDescriptionWriterInventoryCsv,
  checkProductDescriptionWriterInventory,
  parseProductDescriptionWriterInventoryCsv,
  PRODUCT_DESCRIPTION_WRITER_INVENTORY_HEADER,
  type ProductDescriptionWriterInventoryRow,
} from './check-product-description-writers';

const fixtureRoots: string[] = [];

function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

async function writeFixture(root: string, path: string, content: string) {
  await mkdir(join(root, path, '..'), { recursive: true });
  await writeFile(join(root, path), content, 'utf8');
}

async function createFixture() {
  const root = await mkdtemp(join(tmpdir(), 'baci-description-writers-'));
  fixtureRoots.push(root);

  const webWriterPath = 'apps/web/src/app/api/products/writer.ts';
  const webWriter = `
const payload = { description: input.description };
await supabase.from('products').insert(payload);
`;
  const aiProducerPath = 'apps/web/src/ai/flows/generate-description.ts';
  const aiProducer = `
const result = await generateTextWithChain({ prompt: 'description' });
return { description: result.text };
`;
  const sqlWriterPath =
    'supabase/migrations/20260702000000_mobile_description_writer.sql';
  const sqlWriter = `
CREATE OR REPLACE FUNCTION public.save_mobile_admin_product_with_variants()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.products (description) VALUES ('fixture');
END;
$$;
`;

  await Promise.all([
    writeFixture(root, webWriterPath, webWriter),
    writeFixture(root, aiProducerPath, aiProducer),
    writeFixture(root, sqlWriterPath, sqlWriter),
    writeFixture(root, `${webWriterPath.replace(/\.ts$/, '.test.ts')}`, ''),
    writeFixture(root, `${aiProducerPath.replace(/\.ts$/, '.test.ts')}`, ''),
    writeFixture(root, 'apps/mobile-admin/hooks/product-save.test.ts', ''),
  ]);

  const rows: ProductDescriptionWriterInventoryRow[] = [
    {
      inventory_version: '1',
      path: webWriterPath,
      caller_or_route: 'fixture route',
      operation: 'insert public.products.description',
      description_input_contract: 'fixture input',
      can_attest_source: 'no',
      unattested_source: 'unattested_pending_C2b',
      guard_error_contract: 'C3 prepared guard not installed; stable error mapping pending',
      test_path: webWriterPath.replace(/\.ts$/, '.test.ts'),
      file_sha256: sha256(webWriter),
    },
    {
      inventory_version: '1',
      path: aiProducerPath,
      caller_or_route: 'fixture AI action',
      operation: 'generate only; no public.products write',
      description_input_contract: 'fixture prompt',
      can_attest_source: 'no',
      unattested_source: 'unattested_pending_C2b',
      guard_error_contract: 'C3 prepared guard not installed; stable error mapping pending',
      test_path: aiProducerPath.replace(/\.ts$/, '.test.ts'),
      file_sha256: sha256(aiProducer),
    },
    {
      inventory_version: '1',
      path: sqlWriterPath,
      caller_or_route: 'apps/mobile-admin/hooks/product-save.ts',
      operation: 'RPC insert public.products.description',
      description_input_contract: 'p_product_payload.description',
      can_attest_source: 'no',
      unattested_source: 'unattested_pending_C2b',
      guard_error_contract: 'C3 prepared guard not installed; stable error mapping pending',
      test_path: 'apps/mobile-admin/hooks/product-save.test.ts',
      file_sha256: sha256(sqlWriter),
    },
  ];

  return { root, rows, webWriterPath };
}

afterEach(async () => {
  await Promise.all(fixtureRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('checkProductDescriptionWriterInventory', () => {
  it('accepts a complete current writer inventory and preserves the exact CSV header', async () => {
    const { root, rows } = await createFixture();
    const csv = buildProductDescriptionWriterInventoryCsv(rows);

    const result = await checkProductDescriptionWriterInventory({
      inventoryCsv: csv,
      repositoryRoot: root,
      validateCanonicalInventory: false,
    });

    expect(csv.split('\n')[0]).toBe(PRODUCT_DESCRIPTION_WRITER_INVENTORY_HEADER);
    expect(result).toEqual({ errors: [], ok: true });
  });

  it.each([
    [
      'mobile writer',
      'apps/mobile-admin/hooks/unlisted-product-writer.ts',
      "await supabase.from('products').upsert({ description: input.description });",
    ],
    [
      'shared package writer',
      'packages/shared/src/unlisted-product-writer.ts',
      "await client.from('products').update({ description: payload.description });",
    ],
    [
      'top-level SQL writer',
      'supabase/migrations/20260703000000_top_level_description.sql',
      "UPDATE public.products SET description = 'top-level';",
    ],
    [
      'tagged SQL function writer',
      'supabase/migrations/20260704000000_tagged_function_description.sql',
      `CREATE OR REPLACE FUNCTION public.tagged_writer()
RETURNS void LANGUAGE plpgsql AS $writer$
BEGIN
  UPDATE public.products SET description = 'tagged';
END;
$writer$;`,
    ],
    [
      'mobile persistence caller',
      'apps/mobile-admin/hooks/unlisted-product-persistence.ts',
      "await supabase.rpc('save_mobile_admin_product_with_variants', { p_product_payload: { description } });",
    ],
  ] as const)('fails closed for a %s', async (_name, unlistedPath, source) => {
    const { root, rows } = await createFixture();
    await writeFixture(root, unlistedPath, source);

    const result = await checkProductDescriptionWriterInventory({
      inventoryCsv: buildProductDescriptionWriterInventoryCsv(rows),
      repositoryRoot: root,
      validateCanonicalInventory: false,
    });

    expect(result.errors).toEqual([
      `Discovered description writer is not inventoried: ${unlistedPath}`,
    ]);
  });

  it('round-trips CSV values containing a comma, quote, and newline', async () => {
    const { root, rows } = await createFixture();
    const rowsWithCsvCharacters = rows.map((row, index) =>
      index === 0
        ? { ...row, caller_or_route: 'caller, says "quoted"\nnext line' }
        : row
    );

    const result = await checkProductDescriptionWriterInventory({
      inventoryCsv: buildProductDescriptionWriterInventoryCsv(rowsWithCsvCharacters),
      repositoryRoot: root,
      validateCanonicalInventory: false,
    });

    expect(result).toEqual({ errors: [], ok: true });
  });

  it('fails closed when a discovered writer is not inventoried', async () => {
    const { root, rows } = await createFixture();
    const unlistedPath = 'apps/web/src/app/api/products/unlisted-writer.ts';
    await writeFixture(
      root,
      unlistedPath,
      "await supabase.from('products').update({ description: input.description });"
    );

    const result = await checkProductDescriptionWriterInventory({
      inventoryCsv: buildProductDescriptionWriterInventoryCsv(rows),
      repositoryRoot: root,
      validateCanonicalInventory: false,
    });

    expect(result).toEqual({
      errors: [`Discovered description writer is not inventoried: ${unlistedPath}`],
      ok: false,
    });
  });

  it('fails closed when an inventoried writer path is missing', async () => {
    const { root, rows, webWriterPath } = await createFixture();
    await rm(join(root, webWriterPath));
    const result = await checkProductDescriptionWriterInventory({
      inventoryCsv: buildProductDescriptionWriterInventoryCsv(rows),
      repositoryRoot: root,
      validateCanonicalInventory: false,
    });
    expect(result.errors).toEqual([
      `Inventoried writer path is missing: ${webWriterPath}`,
    ]);
  });

  it('fails closed when an inventory path is duplicated', async () => {
    const { root, rows, webWriterPath } = await createFixture();
    const result = await checkProductDescriptionWriterInventory({
      inventoryCsv: buildProductDescriptionWriterInventoryCsv([...rows, rows[0]]),
      repositoryRoot: root,
      validateCanonicalInventory: false,
    });
    expect(result.errors).toEqual([
      `Duplicate inventory path: ${webWriterPath}`,
    ]);
  });

  it('fails closed when the inventory header drifts', async () => {
    const { root, rows } = await createFixture();
    const result = await checkProductDescriptionWriterInventory({
      inventoryCsv: buildProductDescriptionWriterInventoryCsv(rows).replace(
        'inventory_version',
        'inventory_version_drifted'
      ),
      repositoryRoot: root,
      validateCanonicalInventory: false,
    });
    expect(result.errors).toEqual([
      'Inventory CSV header does not match the required schema',
    ]);
  });

  it('fails closed when an inventoried test path is missing', async () => {
    const { root, rows } = await createFixture();
    await rm(join(root, rows[0].test_path));
    const result = await checkProductDescriptionWriterInventory({
      inventoryCsv: buildProductDescriptionWriterInventoryCsv(rows),
      repositoryRoot: root,
      validateCanonicalInventory: false,
    });
    expect(result.errors).toEqual([
      `Inventoried test path is missing: ${rows[0].test_path}`,
    ]);
  });

  it('fails closed when an inventoried writer hash drifts', async () => {
    const { root, rows, webWriterPath } = await createFixture();
    await writeFixture(
      root,
      webWriterPath,
      "await supabase.from('products').insert({ description: input.description });"
    );
    const result = await checkProductDescriptionWriterInventory({
      inventoryCsv: buildProductDescriptionWriterInventoryCsv(rows),
      repositoryRoot: root,
      validateCanonicalInventory: false,
    });
    expect(result.errors).toEqual([`File SHA-256 drift for ${webWriterPath}`]);
  });

  it('fails closed when an inventory attestation field changes', async () => {
    const { root, rows } = await createFixture();
    const changedRows = rows.map((row, index) =>
      index === 0 ? { ...row, can_attest_source: 'yes' } : row
    );
    const result = await checkProductDescriptionWriterInventory({
      inventoryCsv: buildProductDescriptionWriterInventoryCsv(changedRows),
      repositoryRoot: root,
      validateCanonicalInventory: false,
    });
    expect(result.errors).toContain(
      `Invalid inventory field can_attest_source for ${rows[0].path}: expected no`
    );
    expect(result.ok).toBe(false);
  });

  it('returns a schema error for an inventory row with the wrong column count', () => {
    const result = parseProductDescriptionWriterInventoryCsv(
      `${PRODUCT_DESCRIPTION_WRITER_INVENTORY_HEADER}\nonly-one-value\n`
    );
    expect(result).toEqual({
      errors: ['Inventory CSV row 2 does not match the required schema'],
      rows: [],
    });
  });

});
