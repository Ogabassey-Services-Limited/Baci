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
const inventoryVersion = '1';
const unattestedSource = 'unattested_pending_C2b';
const guardErrorContract =
  'C3 prepared guard not installed; stable error mapping pending';

function sha256(content: string) {
  return createHash('sha256').update(content).digest('hex');
}

async function writeFixture(root: string, path: string, content: string) {
  await mkdir(join(root, path, '..'), { recursive: true });
  await writeFile(join(root, path), content, 'utf8');
}

async function createFixture() {
  const root = await mkdtemp(join(tmpdir(), 'baci-description-writer-discovery-'));
  fixtureRoots.push(root);
  const fixtures = [
    {
      path: 'apps/web/src/app/api/products/writer.ts',
      source: "const payload = { description: input.description }; await supabase.from('products').insert(payload);",
      testPath: 'apps/web/src/app/api/products/writer.test.ts',
      operation: 'insert public.products.description',
    },
    {
      path: 'apps/web/src/ai/flows/generate-product-description.ts',
      source: "const result = await generateTextWithChain({ prompt: 'description' }); return { description: result.text };",
      testPath: 'apps/web/src/ai/flows/generate-product-description.test.ts',
      operation: 'generate only; no public.products write',
    },
    {
      path: 'supabase/migrations/20260702000000_mobile_description_writer.sql',
      source: `CREATE OR REPLACE FUNCTION public.save_mobile_admin_product_with_variants()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.products (description) VALUES ('fixture');
END;
$$;`,
      testPath: 'apps/mobile-admin/hooks/product-save.test.ts',
      operation: 'RPC insert public.products.description',
    },
  ] as const;

  await Promise.all(
    fixtures.flatMap(({ path, source, testPath }) => [
      writeFixture(root, path, source),
      writeFixture(root, testPath, ''),
    ])
  );

  const rows: ProductDescriptionWriterInventoryRow[] = fixtures.map(
    ({ path, source, testPath, operation }) => ({
      inventory_version: inventoryVersion,
      path,
      caller_or_route: 'fixture writer',
      operation,
      description_input_contract: 'fixture input',
      can_attest_source: 'no',
      unattested_source: unattestedSource,
      guard_error_contract: guardErrorContract,
      test_path: testPath,
      file_sha256: sha256(source),
    })
  );

  return { root, rows };
}

afterEach(async () => {
  await Promise.all(
    fixtureRoots.splice(0).map((root) =>
      rm(root, { recursive: true, force: true })
    )
  );
});

describe('checkProductDescriptionWriterInventory discovery coverage', () => {
  it('discovers an unlisted AI flow writer with a product path', async () => {
    const { root, rows } = await createFixture();
    const path = 'apps/web/src/ai/flows/generate-product-copy.ts';
    await Promise.all([
      writeFixture(
        root,
        path,
        "const result = await generateTextWithChain({ prompt: 'description' });\nreturn { description: result.text };"
      ),
      writeFixture(root, `${path.replace(/\.ts$/, '.test.ts')}`, ''),
    ]);

    const result = await checkProductDescriptionWriterInventory({
      inventoryCsv: buildProductDescriptionWriterInventoryCsv(rows),
      repositoryRoot: root,
      validateCanonicalInventory: false,
    });

    expect(result.errors).toContain(
      `Discovered description writer is not inventoried: ${path}`
    );
  });

  it.each([
    [
      'MCP writer',
      'apps/web/mcp-server/unlisted-writer.ts',
      "await client.from('products').insert({ description: value });",
    ],
    [
      'temporary web writer',
      'apps/web/scripts-tmp/unlisted-writer.ts',
      "await client.from('products').update({ description: value });",
    ],
    [
      'mobile generated-copy caller',
      'apps/mobile-storefront/hooks/submit-generated-product.ts',
      "const generated = await createCatalogCopy(); await submitProduct({ description: generated.description });",
    ],
    [
      'shared RPC caller',
      'packages/shared/src/save-product-rpc.ts',
      "await db.rpc('persist_product_copy', { product_description: description });",
    ],
  ] as const)('fails closed for a %s', async (_name, path, source) => {
    const { root, rows } = await createFixture();
    await writeFixture(root, path, source);

    const result = await checkProductDescriptionWriterInventory({
      inventoryCsv: buildProductDescriptionWriterInventoryCsv(rows),
      repositoryRoot: root,
      validateCanonicalInventory: false,
    });

    expect(result.errors).toEqual([
      `Discovered description writer is not inventoried: ${path}`,
    ]);
  });
});
