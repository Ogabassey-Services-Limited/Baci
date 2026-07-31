import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import process from 'node:process';

export const PRODUCT_DESCRIPTION_WRITER_INVENTORY_HEADER =
  'inventory_version,path,caller_or_route,operation,description_input_contract,can_attest_source,unattested_source,guard_error_contract,test_path,file_sha256';

export type ProductDescriptionWriterInventoryRow = Record<
  | 'inventory_version'
  | 'path'
  | 'caller_or_route'
  | 'operation'
  | 'description_input_contract'
  | 'can_attest_source'
  | 'unattested_source'
  | 'guard_error_contract'
  | 'test_path'
  | 'file_sha256',
  string
>;

type CheckResult = { errors: string[]; ok: boolean };

const INVENTORY_COLUMNS = PRODUCT_DESCRIPTION_WRITER_INVENTORY_HEADER.split(',') as Array<
  keyof ProductDescriptionWriterInventoryRow
>;
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx']);
const CURRENT_INVENTORY_ROWS: ProductDescriptionWriterInventoryRow[] = [
  {
    inventory_version: '1',
    path: 'apps/web/src/app/api/products/route.ts',
    caller_or_route: 'add-product form -> POST /api/products',
    operation: 'insert public.products.description',
    description_input_contract: 'createProductSchema.description optional string; sanitizeHtml; empty string fallback',
    can_attest_source: 'no',
    unattested_source: 'merchant_unattested',
    guard_error_contract: 'C3 prepared guard not installed; no stable provenance error yet',
    test_path: 'apps/web/src/app/api/products/route.test.ts',
    file_sha256: 'd72a7b81ce7a0333d8c5c37b6e9bfc5e12a0c7e420b26444e406348a12033a92',
  },
  {
    inventory_version: '1',
    path: 'apps/web/src/app/api/products/[id]/route.ts',
    caller_or_route: 'edit-product form -> PUT /api/products/[id]',
    operation: 'update public.products.description',
    description_input_contract: 'updateProductSchema.description optional string or null; sanitizeHtml',
    can_attest_source: 'no',
    unattested_source: 'merchant_unattested',
    guard_error_contract: 'C3 prepared guard not installed; no stable provenance error yet',
    test_path: 'apps/web/src/app/api/products/[id]/route.test.ts',
    file_sha256: 'bbf6b4b564e4d9bf1c085d8139450ed7340fa94f008b5d6a00f9f08502d71e83',
  },
  {
    inventory_version: '1',
    path: 'apps/web/src/app/api/products/bulk-import/route.ts',
    caller_or_route: 'csv-bulk-import-dialog -> multipart POST /api/products/bulk-import',
    operation: 'insert public.products.description',
    description_input_contract: 'CSV description optional string; empty string fallback',
    can_attest_source: 'no',
    unattested_source: 'csv_import_unattested',
    guard_error_contract: 'C3 prepared guard not installed; no stable provenance error yet',
    test_path: 'apps/web/src/app/api/products/bulk-import/route.test.ts',
    file_sha256: '15d0d8675b95a5292cbf49df78311c96ab9f6423a5102fea9cca23ba0ff2274f',
  },
  {
    inventory_version: '1',
    path: 'apps/web/src/app/api/products/bulk-update/bulk-update-change-processing.ts',
    caller_or_route: 'review-changes -> product-context -> bulk-update route -> processor',
    operation: 'insert public.products.description for new bulk-update rows',
    description_input_contract: 'BulkUpdateChange.details.description optional string; empty string fallback',
    can_attest_source: 'no',
    unattested_source: 'bulk_update_unattested',
    guard_error_contract: 'C3 prepared guard not installed; no stable provenance error yet',
    test_path: 'apps/web/src/app/api/products/bulk-update/bulk-update-change-processing.test.ts',
    file_sha256: '2c2ee0dc3e64187880ef5f707ba0c6eac4343e9bd192671628191fb0b3d0482f',
  },
  {
    inventory_version: '1',
    path: 'apps/web/src/lib/import-commit/commit-bumpa-products.ts',
    caller_or_route: 'run-claimed-import-job -> commitBumpaProducts',
    operation: 'insert or update public.products.description',
    description_input_contract: 'NormalizedImportedProduct.description from Bumpa import payload',
    can_attest_source: 'no',
    unattested_source: 'bumpa_import_unattested',
    guard_error_contract: 'C3 prepared guard not installed; no stable provenance error yet',
    test_path: 'apps/web/src/lib/import-commit/commit-bumpa-products.test.ts',
    file_sha256: 'c3f98397d19843877418fe91a1162d8372079b56acf81ebdd68fd657fed1a541',
  },
  {
    inventory_version: '1',
    path: 'apps/web/src/app/api/marketplace/jumia/products/import/route.ts',
    caller_or_route: 'use-products-page-actions -> POST /api/marketplace/jumia/products/import',
    operation: 'upsert public.products.description',
    description_input_contract: 'Jumia product description; stripHtmlTags then sanitizeText; empty string fallback',
    can_attest_source: 'no',
    unattested_source: 'jumia_import_unattested',
    guard_error_contract: 'C3 prepared guard not installed; no stable provenance error yet',
    test_path: 'apps/web/src/app/api/marketplace/jumia/products/import/route.test.ts',
    file_sha256: '813253bdbd7ebfe974b5fc227a03a004fb542312e0a6e11beda1ced99878f4b2',
  },
  {
    inventory_version: '1',
    path: 'apps/web/src/ai/flows/generate-product-descriptions.ts',
    caller_or_route: 'product create UI server action; returned text is saved only by a later writer',
    operation: 'generate only; no public.products write',
    description_input_contract: 'GenerateProductDescriptionInput -> provider text',
    can_attest_source: 'no',
    unattested_source: 'not_persisted',
    guard_error_contract: 'not applicable until a writer persists output',
    test_path: 'apps/web/src/ai/flows/generate-product-descriptions.test.ts',
    file_sha256: '2d75d5427336ed5db57afe4f174ec1db18e09ce5a36edfde08e23eed380d1fc7',
  },
  {
    inventory_version: '1',
    path: 'apps/web/src/ai/flows/autofill-product-details.ts',
    caller_or_route: 'product create UI server action; returned details are saved only by a later writer',
    operation: 'generate only; no public.products write',
    description_input_contract: 'AutofillProductDetailsInput -> generated details.description',
    can_attest_source: 'no',
    unattested_source: 'not_persisted',
    guard_error_contract: 'not applicable until a writer persists output',
    test_path: 'apps/web/src/ai/flows/autofill-product-details.test.ts',
    file_sha256: 'c2e08bc974fd4e485c4ce75af674831204f3712d4a0351dfabc655911731f771',
  },
  {
    inventory_version: '1',
    path: 'supabase/migrations/20260615181534_serialized_variant_inventory.sql',
    caller_or_route: 'legacy private.save_mobile_admin_product_with_variants RPC implementation',
    operation: 'insert or update public.products.description',
    description_input_contract: 'p_product_payload.description JSON text',
    can_attest_source: 'no',
    unattested_source: 'mobile_admin_unattested',
    guard_error_contract: 'C3 prepared guard not installed; PostgreSQL error mapping not yet defined',
    test_path: 'apps/mobile-admin/hooks/product-save.test.ts',
    file_sha256: 'd0f34aeab2a0622c0cae17dbd260c671cc6c96db31f85d414fb19beabb11fce8',
  },
  {
    inventory_version: '1',
    path: 'supabase/migrations/20260702063638_restore_mobile_admin_product_rpc_contract.sql',
    caller_or_route: 'apps/mobile-admin/hooks/product-save.ts -> public.save_mobile_admin_product_with_variants',
    operation: 'insert or update public.products.description',
    description_input_contract: 'p_product_payload.description JSON text',
    can_attest_source: 'no',
    unattested_source: 'mobile_admin_unattested',
    guard_error_contract: 'C3 prepared guard not installed; PostgreSQL error mapping not yet defined',
    test_path: 'apps/mobile-admin/hooks/product-save.test.ts',
    file_sha256: 'a04858072ce04f37af2269bb14bd4a936df612b6243fdb0099e8b417ba9c3ba4',
  },
];

function escapeCsv(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

export function buildProductDescriptionWriterInventoryCsv(
  rows: ProductDescriptionWriterInventoryRow[]
): string {
  return `${PRODUCT_DESCRIPTION_WRITER_INVENTORY_HEADER}\n${rows
    .map((row) => INVENTORY_COLUMNS.map((column) => escapeCsv(row[column])).join(','))
    .join('\n')}\n`;
}

function parseCsv(csv: string): { errors: string[]; rows: ProductDescriptionWriterInventoryRow[] } {
  const lines = csv.trimEnd().split(/\r?\n/);
  if (lines[0] !== PRODUCT_DESCRIPTION_WRITER_INVENTORY_HEADER) {
    return { errors: ['Inventory CSV header does not match the required schema'], rows: [] };
  }
  const rows: ProductDescriptionWriterInventoryRow[] = [];
  for (const [index, line] of lines.slice(1).entries()) {
    const fields = line.split(',');
    if (fields.length !== INVENTORY_COLUMNS.length) {
      return { errors: [`Inventory CSV row ${index + 2} does not match the required schema`], rows: [] };
    }
    rows.push(Object.fromEntries(INVENTORY_COLUMNS.map((column, fieldIndex) => [column, fields[fieldIndex]])) as ProductDescriptionWriterInventoryRow);
  }
  return { errors: [], rows };
}

async function listFiles(root: string): Promise<string[]> {
  if (!existsSync(root)) return [];
  const entries = await readdir(root, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const path = join(root, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  }));
  return files.flat();
}

function isDirectDescriptionWriter(source: string): boolean {
  return /\.from\(\s*['"]products['"]\s*\)(?:(?!;)[\s\S]){0,2500}?\.(?:insert|update|upsert)\s*\(/.test(source)
    && /(?:[,{]\s*description\s*:|\.description\b|\bdescription\s*=)/.test(source);
}

function isAiDescriptionProducer(path: string, source: string): boolean {
  return path.includes('/ai/flows/')
    && /product/i.test(path)
    && /generate(?:Text|Object)WithChain/.test(source)
    && /\bdescription\b/.test(source);
}

async function discoverSqlDescriptionWriters(root: string): Promise<string[]> {
  const migrations = (await listFiles(join(root, 'supabase/migrations'))).filter((path) => path.endsWith('.sql')).sort();
  const latestDefinitions = new Map<string, { path: string; source: string }>();
  for (const path of migrations) {
    const source = await readFile(path, 'utf8');
    for (const match of source.matchAll(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+((?:public|private)\.[a-zA-Z0-9_]+)[\s\S]*?\$\$[\s\S]*?\$\$;/gi)) {
      latestDefinitions.set(match[1], { path, source: match[0] });
    }
  }
  return [...latestDefinitions.values()]
    .filter(({ source }) => /INSERT\s+INTO\s+public\.products\s*\([\s\S]{0,2000}\bdescription\b|UPDATE\s+public\.products[\s\S]{0,1200}\bdescription\s*=/i.test(source))
    .map(({ path }) => relative(root, path));
}

async function discoverWriterPaths(root: string): Promise<string[]> {
  const webFiles = (await listFiles(join(root, 'apps/web/src'))).filter((path) => SOURCE_EXTENSIONS.has(path.slice(path.lastIndexOf('.'))) && !path.includes('.test.'));
  const discovered = await Promise.all(webFiles.map(async (path) => {
    const source = await readFile(path, 'utf8');
    const relativePath = relative(root, path);
    return isDirectDescriptionWriter(source) || isAiDescriptionProducer(relativePath, source) ? [relativePath] : [];
  }));
  return [...new Set([...discovered.flat(), ...(await discoverSqlDescriptionWriters(root))])].sort();
}

export async function checkProductDescriptionWriterInventory({ inventoryCsv, repositoryRoot }: { inventoryCsv: string; repositoryRoot: string }): Promise<CheckResult> {
  const parsed = parseCsv(inventoryCsv);
  if (parsed.errors.length > 0) return { errors: parsed.errors, ok: false };
  const errors: string[] = [];
  const paths = new Set<string>();
  for (const row of parsed.rows) {
    if (paths.has(row.path)) errors.push(`Duplicate inventory path: ${row.path}`);
    paths.add(row.path);
    const writerPath = join(repositoryRoot, row.path);
    if (!existsSync(writerPath)) {
      errors.push(`Inventoried writer path is missing: ${row.path}`);
    } else if (createHash('sha256').update(await readFile(writerPath)).digest('hex') !== row.file_sha256) {
      errors.push(`File SHA-256 drift for ${row.path}`);
    }
    if (!existsSync(join(repositoryRoot, row.test_path))) errors.push(`Inventoried test path is missing: ${row.test_path}`);
  }
  for (const path of await discoverWriterPaths(repositoryRoot)) {
    if (!paths.has(path)) errors.push(`Discovered description writer is not inventoried: ${path}`);
  }
  return { errors, ok: errors.length === 0 };
}

async function main() {
  const outputIndex = process.argv.indexOf('--output');
  const output = outputIndex >= 0 ? process.argv[outputIndex + 1] : undefined;
  if (!output) throw new Error('Usage: tsx check-product-description-writers.ts --output <csv-path>');
  const repositoryRoot = join(process.cwd(), '..', '..');
  const inventoryCsv = existsSync(output) ? await readFile(output, 'utf8') : buildProductDescriptionWriterInventoryCsv(CURRENT_INVENTORY_ROWS);
  const result = await checkProductDescriptionWriterInventory({ inventoryCsv, repositoryRoot });
  if (!result.ok) throw new Error(result.errors.join('\n'));
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, inventoryCsv, 'utf8');
  process.stdout.write(`Product description writer inventory verified: ${output}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) void main();
