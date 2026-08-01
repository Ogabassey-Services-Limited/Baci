import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  CURRENT_INVENTORY_ROWS,
  CURRENT_INVENTORY_ROWS_BY_PATH,
  EXPECTED_INVENTORY_FIELDS,
  INVENTORY_COLUMNS,
  type CheckResult,
  type ProductDescriptionWriterInventoryRow,
} from './product-description-writer-inventory';
import { parseProductDescriptionWriterInventoryCsv } from './product-description-writer-inventory-csv';
import * as writerDiscovery from './product-description-writer-discovery';

export async function checkProductDescriptionWriterInventory({
  canonicalInventoryRows,
  inventoryCsv,
  repositoryRoot,
  validateCanonicalInventory = true,
}: {
  canonicalInventoryRows?: readonly ProductDescriptionWriterInventoryRow[];
  inventoryCsv: string;
  repositoryRoot: string;
  validateCanonicalInventory?: boolean;
}): Promise<CheckResult> {
  const parsed = parseProductDescriptionWriterInventoryCsv(inventoryCsv);
  if (parsed.errors.length) return { errors: parsed.errors, ok: false };

  const errors: string[] = [];
  const inventoryPaths = new Set<string>();
  const canonicalRows = canonicalInventoryRows ?? CURRENT_INVENTORY_ROWS;
  const canonicalRowsByPath =
    canonicalInventoryRows === undefined
      ? CURRENT_INVENTORY_ROWS_BY_PATH
      : new Map(canonicalRows.map((entry) => [entry.path, entry]));
  for (const entry of parsed.rows) {
    if (inventoryPaths.has(entry.path)) {
      errors.push(`Duplicate inventory path: ${entry.path}`);
    }
    inventoryPaths.add(entry.path);
    const canonicalEntry = canonicalRowsByPath.get(entry.path);
    if (validateCanonicalInventory && canonicalEntry) {
      for (const column of INVENTORY_COLUMNS) {
        if (entry[column] !== canonicalEntry[column]) {
          errors.push(`Canonical inventory drift for ${entry.path}: ${column}`);
        }
      }
    }
    for (const [field, expected] of Object.entries(EXPECTED_INVENTORY_FIELDS)) {
      if (entry[field as keyof typeof EXPECTED_INVENTORY_FIELDS] !== expected) {
        errors.push(
          `Invalid inventory field ${field} for ${entry.path}: expected ${expected}`
        );
      }
    }
    const source = join(repositoryRoot, entry.path);
    if (!existsSync(source)) {
      errors.push(`Inventoried writer path is missing: ${entry.path}`);
    } else if (
      createHash('sha256').update(await readFile(source)).digest('hex') !==
      entry.file_sha256
    ) {
      errors.push(`File SHA-256 drift for ${entry.path}`);
    }
    if (!existsSync(join(repositoryRoot, entry.test_path))) {
      errors.push(`Inventoried test path is missing: ${entry.test_path}`);
    }
  }

  if (validateCanonicalInventory) {
    for (const entry of canonicalRows) {
      if (!inventoryPaths.has(entry.path)) {
        errors.push(`Canonical inventory row is missing: ${entry.path}`);
      }
    }
  }
  for (const path of await writerDiscovery.discoverWriterPaths(repositoryRoot)) {
    if (!inventoryPaths.has(path)) {
      errors.push(`Discovered description writer is not inventoried: ${path}`);
    }
  }
  return { errors, ok: errors.length === 0 };
}
