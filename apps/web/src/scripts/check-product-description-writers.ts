import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  buildProductDescriptionWriterInventoryCsv,
  parseProductDescriptionWriterInventoryCsv,
} from './product-description-writer-inventory-csv';
import {
  CURRENT_INVENTORY_ROWS,
  type ProductDescriptionWriterInventoryRow,
  PRODUCT_DESCRIPTION_WRITER_INVENTORY_HEADER,
} from './product-description-writer-inventory';
import { checkProductDescriptionWriterInventory } from './product-description-writer-inventory-check';
import { readFilesWithConcurrency } from './product-description-writer-file-reading';

export {
  buildProductDescriptionWriterInventoryCsv,
  checkProductDescriptionWriterInventory,
  parseProductDescriptionWriterInventoryCsv,
  PRODUCT_DESCRIPTION_WRITER_INVENTORY_HEADER,
  readFilesWithConcurrency,
};
export type { ProductDescriptionWriterInventoryRow } from './product-description-writer-inventory';

async function main() {
  const index = process.argv.indexOf('--output');
  const output = index >= 0 ? process.argv[index + 1] : undefined;
  if (!output) {
    throw new Error(
      'Usage: tsx check-product-description-writers.ts --output <csv-path>'
    );
  }
  const repositoryRoot = join(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    '..',
    '..',
    '..'
  );
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
