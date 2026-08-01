import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const PRODUCT_DESCRIPTION_WRITER_INVENTORY_HEADER =
  'inventory_version,path,caller_or_route,operation,description_input_contract,can_attest_source,unattested_source,guard_error_contract,test_path,file_sha256';

type Column =
  | 'inventory_version' | 'path' | 'caller_or_route' | 'operation'
  | 'description_input_contract' | 'can_attest_source' | 'unattested_source'
  | 'guard_error_contract' | 'test_path' | 'file_sha256';
export type ProductDescriptionWriterInventoryRow = Record<Column, string>;
type CheckResult = { errors: string[]; ok: boolean };
type FunctionDefinition = { body: string; end: number; name: string; start: number };

const COLUMNS = PRODUCT_DESCRIPTION_WRITER_INVENTORY_HEADER.split(',') as Column[];
const TS_ROOTS = ['apps/web/src', 'apps/web/mcp-server', 'apps/web/scripts-tmp', 'apps/mobile-admin', 'apps/mobile-storefront', 'packages', 'supabase/functions'];
const TS_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts']);
const DEFAULT_FILE_READ_CONCURRENCY = 32;
const UNATTESTED = 'unattested_pending_C2b';
const GUARD = 'C3 prepared guard not installed; stable error mapping pending';
const EXPECTED_INVENTORY_FIELDS = {
  inventory_version: '1',
  can_attest_source: 'no',
  unattested_source: UNATTESTED,
  guard_error_contract: GUARD,
} as const;
const HASHES: Record<string, string> = {
  'apps/web/src/schemas/products.ts': 'ce02c458edf20d90f7ea395df926473542406addca46e917912ef7ae66f17b5f', 'apps/web/src/app/dashboard/products/add/add-product-form.tsx': '1742d39c6f45ffb1db3051252a1348018e9de681ea02d831e1ad79ff920bdd7f', 'apps/web/src/app/api/products/route.ts': 'd72a7b81ce7a0333d8c5c37b6e9bfc5e12a0c7e420b26444e406348a12033a92', 'apps/web/src/app/api/products/[id]/route.ts': 'bbf6b4b564e4d9bf1c085d8139450ed7340fa94f008b5d6a00f9f08502d71e83', 'apps/web/src/components/products/csv-bulk-import-dialog.tsx': 'ebcf3dfa786f49243b6fa7a64caa451ebaea4097529b26394e26cf05da48fe4d', 'apps/web/src/app/api/products/bulk-import/route.ts': '15d0d8675b95a5292cbf49df78311c96ab9f6423a5102fea9cca23ba0ff2274f', 'apps/web/src/components/products/review-changes.tsx': 'c6e4a42e07025b9b65a3ff33eb2e0c4732e5814270b0597051ab25573428b93b', 'apps/web/src/contexts/product-context.tsx': '3e47398edc8a6109058d847bef93392f3950f25fd446e3c95601d1ff7dcb5743', 'apps/web/src/app/api/products/bulk-update/route.ts': '0e71cbf869330b065bfe2909e7b0d213d9af247495a810e8f6fae4b4080ca1ef', 'apps/web/src/app/api/products/bulk-update/bulk-update-change-processing.ts': '2c2ee0dc3e64187880ef5f707ba0c6eac4343e9bd192671628191fb0b3d0482f', 'apps/web/src/lib/import-jobs/run-claimed-import-job.ts': '8652502134b8c7912dd28c870a708c1290b51702fac6a3de171ae4c4e2a0483c', 'apps/web/src/lib/import-commit/commit-bumpa-products.ts': 'c3f98397d19843877418fe91a1162d8372079b56acf81ebdd68fd657fed1a541', 'apps/web/src/app/dashboard/products/use-products-page-actions.ts': '38f752fb0e755715a1b5202148fa5f95a22a40b6380244d90db6406fff145a49', 'apps/web/src/app/api/marketplace/jumia/products/import/route.ts': '813253bdbd7ebfe974b5fc227a03a004fb542312e0a6e11beda1ced99878f4b2', 'apps/mobile-admin/hooks/product-save.ts': 'b30f9431b0c7968880e3ce4d7b55db74a72afaa07e09ab2cab72c275994b4558', 'supabase/migrations/20260615181534_serialized_variant_inventory.sql': 'd0f34aeab2a0622c0cae17dbd260c671cc6c96db31f85d414fb19beabb11fce8', 'supabase/migrations/20260702063638_restore_mobile_admin_product_rpc_contract.sql': 'a04858072ce04f37af2269bb14bd4a936df612b6243fdb0099e8b417ba9c3ba4', 'apps/web/src/ai/flows/generate-product-descriptions.ts': '2d75d5427336ed5db57afe4f174ec1db18e09ce5a36edfde08e23eed380d1fc7', 'apps/web/src/ai/flows/autofill-product-details.ts': 'c2e08bc974fd4e485c4ce75af674831204f3712d4a0351dfabc655911731f771',
};
const row = (path: string, caller: string, operation: string, contract: string, test: string): ProductDescriptionWriterInventoryRow => ({
  inventory_version: '1', path, caller_or_route: caller, operation, description_input_contract: contract,
  can_attest_source: 'no', unattested_source: UNATTESTED, guard_error_contract: GUARD, test_path: test, file_sha256: HASHES[path] ?? '',
});
const CURRENT_INVENTORY_ROWS = [
  row('apps/web/src/schemas/products.ts', 'web create/update route schemas', 'description contract', 'create/update description schema', 'apps/web/src/schemas/products.test.ts'),
  row('apps/web/src/app/dashboard/products/add/add-product-form.tsx', 'add/edit form; AI result -> submitted product', 'AI persistence caller', 'form description including generated text', 'apps/web/src/app/dashboard/products/add/add-product-form.test.tsx'),
  row('apps/web/src/app/api/products/route.ts', 'add form -> POST /api/products', 'insert public.products.description', 'createProductSchema description', 'apps/web/src/app/api/products/route.test.ts'),
  row('apps/web/src/app/api/products/[id]/route.ts', 'edit form -> PUT /api/products/[id]', 'update public.products.description', 'updateProductSchema description', 'apps/web/src/app/api/products/[id]/route.test.ts'),
  row('apps/web/src/components/products/csv-bulk-import-dialog.tsx', 'CSV dialog -> multipart import route', 'CSV persistence caller', 'CSV description column', 'apps/web/src/components/products/csv-bulk-import-dialog.test.tsx'),
  row('apps/web/src/app/api/products/bulk-import/route.ts', 'CSV dialog -> bulk import route', 'insert public.products.description', 'optional CSV description', 'apps/web/src/app/api/products/bulk-import/route.test.ts'),
  row('apps/web/src/components/products/review-changes.tsx', 'review UI -> product context', 'bulk-update persistence caller', 'BulkUpdateChange description', 'apps/web/src/components/products/review-changes.test.tsx'),
  row('apps/web/src/contexts/product-context.tsx', 'review UI -> bulk-update route', 'bulk-update persistence caller', 'product change description', 'apps/web/src/contexts/product-context.test.tsx'),
  row('apps/web/src/app/api/products/bulk-update/route.ts', 'product context -> bulk processor', 'bulk-update route caller', 'validated change description', 'apps/web/src/app/api/products/bulk-update/route.test.ts'),
  row('apps/web/src/app/api/products/bulk-update/bulk-update-change-processing.ts', 'bulk-update route -> processor', 'insert public.products.description', 'new change details.description', 'apps/web/src/app/api/products/bulk-update/bulk-update-change-processing.test.ts'),
  row('apps/web/src/lib/import-jobs/run-claimed-import-job.ts', 'claimed Bumpa job -> commit helper', 'Bumpa persistence caller', 'normalized product description', 'apps/web/src/lib/import-jobs/run-claimed-import-job.test.ts'),
  row('apps/web/src/lib/import-commit/commit-bumpa-products.ts', 'Bumpa commit helper', 'insert/update public.products.description', 'NormalizedImportedProduct.description', 'apps/web/src/lib/import-commit/commit-bumpa-products.test.ts'),
  row('apps/web/src/app/dashboard/products/use-products-page-actions.ts', 'dashboard action -> Jumia import', 'Jumia persistence caller', 'Jumia imported description', 'apps/web/src/app/dashboard/products/use-products-page-actions.test.ts'),
  row('apps/web/src/app/api/marketplace/jumia/products/import/route.ts', 'dashboard action -> Jumia import', 'upsert public.products.description', 'sanitized Jumia description', 'apps/web/src/app/api/marketplace/jumia/products/import/route.test.ts'),
  row('apps/mobile-admin/hooks/product-save.ts', 'mobile create/update -> public RPC', 'RPC persistence caller', 'ProductDbSchema payload description', 'apps/mobile-admin/hooks/product-save.test.ts'),
  row('supabase/migrations/20260615181534_serialized_variant_inventory.sql', 'legacy private mobile product-save RPC', 'insert/update public.products.description', 'p_product_payload.description', 'apps/mobile-admin/hooks/product-save.test.ts'),
  row('supabase/migrations/20260702063638_restore_mobile_admin_product_rpc_contract.sql', 'mobile hook -> current public RPC', 'insert/update public.products.description', 'p_product_payload.description', 'apps/mobile-admin/hooks/product-save.test.ts'),
  row('apps/web/src/ai/flows/generate-product-descriptions.ts', 'add/edit form server action', 'generate only; persisted by add form', 'GenerateProductDescriptionInput -> text', 'apps/web/src/ai/flows/generate-product-descriptions.test.ts'),
  row('apps/web/src/ai/flows/autofill-product-details.ts', 'add/edit form server action', 'generate only; persisted by add form', 'Autofill input -> details.description', 'apps/web/src/ai/flows/autofill-product-details.test.ts'),
];
const CURRENT_INVENTORY_ROWS_BY_PATH = new Map(
  CURRENT_INVENTORY_ROWS.map((entry) => [entry.path, entry])
);

function escapeCsv(value: string): string { return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value; }
export function buildProductDescriptionWriterInventoryCsv(rows: ProductDescriptionWriterInventoryRow[]): string {
  return `${PRODUCT_DESCRIPTION_WRITER_INVENTORY_HEADER}\n${rows.map((entry) => COLUMNS.map((column) => escapeCsv(entry[column])).join(',')).join('\n')}\n`;
}
export function parseProductDescriptionWriterInventoryCsv(
  csv: string
): { errors: string[]; rows: ProductDescriptionWriterInventoryRow[] } {
  const fields: string[][] = [[]]; let field = ''; let quoted = false;
  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index]; const next = csv[index + 1];
    if (quoted && char === '"' && next === '"') { field += '"'; index += 1; continue; }
    if (char === '"') { if (!quoted && field) return { errors: ['Inventory CSV contains an invalid quote'], rows: [] }; quoted = !quoted; continue; }
    if (!quoted && char === ',') { fields.at(-1)?.push(field); field = ''; continue; }
    if (!quoted && (char === '\n' || char === '\r')) {
      if (char === '\r' && next === '\n') index += 1;
      fields.at(-1)?.push(field); field = ''; fields.push([]); continue;
    }
    field += char;
  }
  if (quoted) return { errors: ['Inventory CSV contains an unterminated quoted field'], rows: [] };
  fields.at(-1)?.push(field);
  if (fields.at(-1)?.length === 1 && fields.at(-1)?.[0] === '') fields.pop();
  if (fields[0]?.join(',') !== PRODUCT_DESCRIPTION_WRITER_INVENTORY_HEADER) return { errors: ['Inventory CSV header does not match the required schema'], rows: [] };
  try {
    const rows = fields.slice(1).map((values, index) => {
      if (values.length !== COLUMNS.length) {
        throw new Error(`Inventory CSV row ${index + 2} does not match the required schema`);
      }
      return Object.fromEntries(
        COLUMNS.map((column, valueIndex) => [column, values[valueIndex]])
      ) as ProductDescriptionWriterInventoryRow;
    });
    return { errors: [], rows };
  } catch (error) {
    return {
      errors: [
        error instanceof Error
          ? error.message
          : 'Inventory CSV does not match the required schema',
      ],
      rows: [],
    };
  }
}

async function listFiles(root: string): Promise<string[]> {
  if (!existsSync(root)) return [];
  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(path)));
    } else {
      files.push(path);
    }
  }
  return files;
}
export async function readFilesWithConcurrency(
  files: string[],
  concurrency = DEFAULT_FILE_READ_CONCURRENCY,
  reader: (path: string) => Promise<string> = (path) => readFile(path, 'utf8')
): Promise<string[]> {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new RangeError('File read concurrency must be a positive integer');
  }
  const contents = new Array<string>(files.length);
  let nextIndex = 0;
  const workerCount = Math.min(concurrency, files.length);
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < files.length) {
        const index = nextIndex;
        nextIndex += 1;
        contents[index] = await reader(files[index]);
      }
    })
  );
  return contents;
}
function writesDescription(source: string): boolean { return /\bdescription\b/.test(source); }
function directProductsMutation(source: string): boolean {
  return /\.from\(\s*['"]products['"]\s*\)(?:(?![;{}])[\s\S])*?\.(?:insert|update|upsert)\s*\(/.test(source) && writesDescription(source);
}
function persistenceCaller(path: string, source: string): boolean {
  const productRpc = /\.rpc\(\s*['"](?=[^'"]*(?:product|catalog))(?=[^'"]*(?:save|create|update|upsert|persist|write))[^'"]+['"]\s*,[\s\S]*?\b(?:description|product_description)\b/i.test(source);
  const generatedCopy = /await\s+\w*(?:generate|autofill|compose|draft|create)\w*(?:description|details|copy)\w*\s*\(/i.test(source);
  const productSubmit = /(?:submit|create|update|save|on)\w*(?:product|catalog|listing|item)\w*\s*\([\s\S]*?\bdescription\b/i.test(source);
  return (productRpc || (generatedCopy && productSubmit)) && writesDescription(source) && !path.includes('.test.') && !path.endsWith('check-product-description-writers.ts');
}
function aiProducer(path: string, source: string): boolean {
  return path.includes('/ai/flows/') && /product/i.test(path) && /generate(?:Text|Object)WithChain/.test(source) && writesDescription(source);
}
function functionDefinitions(source: string): FunctionDefinition[] {
  const definitions: FunctionDefinition[] = []; const startPattern = /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+((?:public|private)\.[\w]+)[\s\S]*?\bAS\s+(\$[\w]*\$)/gi;
  for (const match of source.matchAll(startPattern)) { const start = match.index ?? 0; const tag = match[2]; const bodyStart = start + match[0].length; const bodyEnd = source.indexOf(tag, bodyStart); if (bodyEnd >= 0) definitions.push({ name: match[1], start, end: bodyEnd + tag.length, body: source.slice(bodyStart, bodyEnd) }); }
  return definitions;
}
function sqlWritesDescription(source: string): boolean {
  return /INSERT\s+INTO\s+public\.products\s*\([\s\S]*?\bdescription\b[\s\S]*?\)\s*VALUES|UPDATE\s+public\.products\b[\s\S]*?\bSET\b[\s\S]*?\bdescription\s*=/i.test(source);
}
async function discoverSql(root: string): Promise<string[]> {
  const files = (await listFiles(join(root, 'supabase/migrations'))).filter((path) => path.endsWith('.sql') && !path.includes('/migrations/tests/')).sort();
  const latest = new Map<string, { path: string; body: string }>(); const discovered = new Set<string>();
  for (const path of files) { const source = await readFile(path, 'utf8'); const definitions = functionDefinitions(source); let topLevel = source;
    for (const definition of definitions) { latest.set(definition.name, { path, body: definition.body }); topLevel = `${topLevel.slice(0, definition.start)}${' '.repeat(definition.end - definition.start)}${topLevel.slice(definition.end)}`; }
    if (sqlWritesDescription(topLevel)) discovered.add(relative(root, path));
  }
  for (const { path, body } of latest.values()) if (sqlWritesDescription(body)) discovered.add(relative(root, path));
  return [...discovered];
}
async function discoverWriterPaths(root: string): Promise<string[]> {
  const files = (await Promise.all(TS_ROOTS.map((path) => listFiles(join(root, path))))).flat().filter((path) => TS_EXTENSIONS.has(path.slice(path.lastIndexOf('.'))) && !path.includes('.test.'));
  const sources = await readFilesWithConcurrency(files);
  const paths = files.map((path, index) => { const source = sources[index]; const rel = relative(root, path); return directProductsMutation(source) || persistenceCaller(rel, source) || aiProducer(rel, source) ? [rel] : []; });
  return [...new Set([...paths.flat(), ...(await discoverSql(root))])].sort();
}

export async function checkProductDescriptionWriterInventory({
  canonicalInventoryRows,
  inventoryCsv,
  repositoryRoot,
}: {
  canonicalInventoryRows?: readonly ProductDescriptionWriterInventoryRow[];
  inventoryCsv: string;
  repositoryRoot: string;
}): Promise<CheckResult> {
  let parsed: { errors: string[]; rows: ProductDescriptionWriterInventoryRow[] };
  try {
    parsed = parseProductDescriptionWriterInventoryCsv(inventoryCsv);
  } catch (error) {
    return {
      errors: [
        error instanceof Error
          ? error.message
          : 'Inventory CSV does not match the required schema',
      ],
      ok: false,
    };
  }
  if (parsed.errors.length) return { errors: parsed.errors, ok: false };
  const errors: string[] = [];
  const inventoryPaths = new Set<string>();
  const canonicalRows = canonicalInventoryRows ?? CURRENT_INVENTORY_ROWS;
  const canonicalRowsByPath =
    canonicalInventoryRows === undefined
      ? CURRENT_INVENTORY_ROWS_BY_PATH
      : new Map(canonicalRows.map((entry) => [entry.path, entry]));
  const shouldValidateCanonicalInventory =
    canonicalInventoryRows !== undefined ||
    parsed.rows.some((entry) => canonicalRowsByPath.has(entry.path));
  for (const entry of parsed.rows) {
    if (inventoryPaths.has(entry.path)) {
      errors.push(`Duplicate inventory path: ${entry.path}`);
    }
    inventoryPaths.add(entry.path);
    const canonicalEntry = canonicalRowsByPath.get(entry.path);
    if (shouldValidateCanonicalInventory && canonicalEntry) {
      for (const column of COLUMNS) {
        if (entry[column] !== canonicalEntry[column]) {
          errors.push(
            `Canonical inventory drift for ${entry.path}: ${column}`
          );
        }
      }
    }
    for (const [field, expected] of Object.entries(EXPECTED_INVENTORY_FIELDS)) {
      if (entry[field as keyof typeof EXPECTED_INVENTORY_FIELDS] !== expected) {
        errors.push(`Invalid inventory field ${field} for ${entry.path}: expected ${expected}`);
      }
    }
    const source = join(repositoryRoot, entry.path);
    if (!existsSync(source)) errors.push(`Inventoried writer path is missing: ${entry.path}`);
    else if (createHash('sha256').update(await readFile(source)).digest('hex') !== entry.file_sha256) errors.push(`File SHA-256 drift for ${entry.path}`);
    if (!existsSync(join(repositoryRoot, entry.test_path))) errors.push(`Inventoried test path is missing: ${entry.test_path}`);
  }
  if (shouldValidateCanonicalInventory) {
    for (const entry of canonicalRows) {
      if (!inventoryPaths.has(entry.path)) {
        errors.push(`Canonical inventory row is missing: ${entry.path}`);
      }
    }
  }
  for (const path of await discoverWriterPaths(repositoryRoot)) if (!inventoryPaths.has(path)) errors.push(`Discovered description writer is not inventoried: ${path}`);
  return { errors, ok: errors.length === 0 };
}
async function main() {
  const index = process.argv.indexOf('--output');
  const output = index >= 0 ? process.argv[index + 1] : undefined;
  if (!output) {
    throw new Error('Usage: tsx check-product-description-writers.ts --output <csv-path>');
  }
  const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
  const csv = existsSync(output)
    ? await readFile(output, 'utf8')
    : buildProductDescriptionWriterInventoryCsv(CURRENT_INVENTORY_ROWS);
  const result = await checkProductDescriptionWriterInventory({
    inventoryCsv: csv,
    repositoryRoot,
  });
  if (!result.ok) {
    throw new Error(result.errors.join('\n'));
  }
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, csv, 'utf8');
  process.stdout.write(`Product description writer inventory verified: ${output}\n`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}
