import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildProductDescriptionWriterInventoryCsv,
  checkProductDescriptionWriterInventory,
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
      unattested_source: 'merchant_unattested',
      guard_error_contract: 'prepared_guard_not_yet_installed',
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
      unattested_source: 'not_persisted',
      guard_error_contract: 'not_applicable_not_persisted',
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
      unattested_source: 'mobile_admin_unattested',
      guard_error_contract: 'prepared_guard_not_yet_installed',
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
    });

    expect(csv.split('\n')[0]).toBe(PRODUCT_DESCRIPTION_WRITER_INVENTORY_HEADER);
    expect(result).toEqual({ errors: [], ok: true });
  });

  it('fails closed across mobile, packages, SQL, and persistence-caller surfaces', async () => {
    const { root, rows } = await createFixture();
    const unlistedPaths = [
      'apps/mobile-admin/hooks/unlisted-product-writer.ts',
      'packages/shared/src/unlisted-product-writer.ts',
      'supabase/migrations/20260703000000_top_level_description.sql',
      'supabase/migrations/20260704000000_tagged_function_description.sql',
      'apps/mobile-admin/hooks/unlisted-product-persistence.ts',
    ];
    await Promise.all([
      writeFixture(root, unlistedPaths[0], "await supabase.from('products').upsert({ description: input.description });"),
      writeFixture(root, unlistedPaths[1], "await client.from('products').update({ description: payload.description });"),
      writeFixture(root, unlistedPaths[2], "UPDATE public.products SET description = 'top-level';"),
      writeFixture(root, unlistedPaths[3], `CREATE OR REPLACE FUNCTION public.tagged_writer()
RETURNS void LANGUAGE plpgsql AS $writer$
BEGIN
  UPDATE public.products SET description = 'tagged';
END;
$writer$;`),
      writeFixture(root, unlistedPaths[4], "await supabase.rpc('save_mobile_admin_product_with_variants', { p_product_payload: { description } });"),
    ]);

    const result = await checkProductDescriptionWriterInventory({
      inventoryCsv: buildProductDescriptionWriterInventoryCsv(rows),
      repositoryRoot: root,
    });

    expect(result.errors).toEqual(
      expect.arrayContaining(
        unlistedPaths.map((path) => `Discovered description writer is not inventoried: ${path}`)
      )
    );
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
    });

    expect(result).toEqual({
      errors: [`Discovered description writer is not inventoried: ${unlistedPath}`],
      ok: false,
    });
  });

  it('fails closed for a missing inventoried path, duplicate path, header drift, missing test path, and SHA drift', async () => {
    const { root, rows, webWriterPath } = await createFixture();
    const csv = buildProductDescriptionWriterInventoryCsv(rows);

    await rm(join(root, webWriterPath));
    const missingPath = await checkProductDescriptionWriterInventory({
      inventoryCsv: csv,
      repositoryRoot: root,
    });
    expect(missingPath.errors).toContain(`Inventoried writer path is missing: ${webWriterPath}`);

    const duplicate = await checkProductDescriptionWriterInventory({
      inventoryCsv: buildProductDescriptionWriterInventoryCsv([...rows, rows[0]]),
      repositoryRoot: root,
    });
    expect(duplicate.errors).toContain(`Duplicate inventory path: ${webWriterPath}`);

    const headerDrift = await checkProductDescriptionWriterInventory({
      inventoryCsv: csv.replace('inventory_version', 'inventory_version_drifted'),
      repositoryRoot: root,
    });
    expect(headerDrift.errors).toContain('Inventory CSV header does not match the required schema');

    await writeFixture(root, webWriterPath, 'await supabase.from(\'products\').insert({ description: input.description });');
    await rm(join(root, rows[0].test_path));
    const missingTestAndHashDrift = await checkProductDescriptionWriterInventory({
      inventoryCsv: csv,
      repositoryRoot: root,
    });
    expect(missingTestAndHashDrift.errors).toEqual(
      expect.arrayContaining([
        `Inventoried test path is missing: ${rows[0].test_path}`,
        `File SHA-256 drift for ${webWriterPath}`,
      ])
    );
  });
});

  it('fails closed for generic AI and RPC callers plus MCP and temporary web scripts', async () => {
    const { root, rows } = await createFixture();
    const paths = [
      'apps/web/mcp-server/unlisted-writer.ts',
      'apps/web/scripts-tmp/unlisted-writer.ts',
      'apps/mobile-storefront/hooks/submit-generated-product.ts',
      'packages/shared/src/save-product-rpc.ts',
    ];
    await Promise.all([
      writeFixture(root, paths[0], "await client.from('products').insert({ description: value });"),
      writeFixture(root, paths[1], "await client.from('products').update({ description: value });"),
      writeFixture(root, paths[2], "const generated = await createCatalogCopy(); await submitProduct({ description: generated.description });"),
      writeFixture(root, paths[3], "await db.rpc('persist_product_copy', { product_description: description });"),
    ]);

    const result = await checkProductDescriptionWriterInventory({
      inventoryCsv: buildProductDescriptionWriterInventoryCsv(rows),
      repositoryRoot: root,
    });

    expect(result.errors).toEqual(
      expect.arrayContaining(
        paths.map((path) => `Discovered description writer is not inventoried: ${path}`)
      )
    );
  });
