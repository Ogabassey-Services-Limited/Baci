import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const migrationFileName =
  '20260702063638_restore_mobile_admin_product_rpc_contract.sql';
const migrationsDir = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../supabase/migrations'
);
const publicRpcDefinitionPattern =
  /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.save_mobile_admin_product_with_variants\s*\(/i;
const publicRpcDropPattern =
  /DROP\s+FUNCTION(?:\s+IF\s+EXISTS)?\s+public\.save_mobile_admin_product_with_variants\s*\(/i;
const rpcMigrationEntries = readdirSync(migrationsDir)
  .filter((fileName) => fileName.endsWith('.sql'))
  .sort()
  .map((fileName) => {
    const sql = readFileSync(resolve(migrationsDir, fileName), 'utf8');
    return { fileName, sql };
  })
  .filter(
    ({ sql }) =>
      publicRpcDefinitionPattern.test(sql) || publicRpcDropPattern.test(sql)
  );
const latestRpcMigration = rpcMigrationEntries.at(-1);
const migrationSql = latestRpcMigration?.sql ?? '';

const productInsertSql =
  migrationSql.match(
    /INSERT\s+INTO\s+public\.products\s+\([\s\S]*?\)\s+VALUES\s+\([\s\S]*?\)\s+RETURNING\s+id\s+INTO\s+v_updated_product_id/i
  )?.[0] ?? '';

const returningUpdatedProductId =
  'RETURNING products.id INTO v_updated_product_id';
const productPersistUpdateMatch = migrationSql.match(
  /UPDATE\s+public\.products\s+SET\s+name\s*=\s*CASE/i
);
const productPersistUpdateIndex = productPersistUpdateMatch?.index ?? -1;
const productPersistUpdateEndIndex =
  productPersistUpdateIndex === -1
    ? -1
    : migrationSql.indexOf(
        returningUpdatedProductId,
        productPersistUpdateIndex
      );
const productPersistUpdateSql =
  productPersistUpdateIndex === -1 || productPersistUpdateEndIndex === -1
    ? ''
    : migrationSql.slice(
        productPersistUpdateIndex,
        productPersistUpdateEndIndex + returningUpdatedProductId.length
      );
const productPersistenceSql = `${productInsertSql}\n${productPersistUpdateSql}`;

const createVariantModelIndex = migrationSql.indexOf(
  'v_variant_model := COALESCE('
);
const updateVariantModelIndex = migrationSql.indexOf(
  'v_variant_model := COALESCE(',
  createVariantModelIndex + 1
);
const createVariantModelEndIndex =
  createVariantModelIndex === -1
    ? -1
    : migrationSql.indexOf('v_has_variants :=', createVariantModelIndex);
const updateVariantModelEndIndex =
  updateVariantModelIndex === -1
    ? -1
    : migrationSql.indexOf(
        'IF NOT (v_product_payload',
        updateVariantModelIndex
      );
const createVariantModelSql =
  createVariantModelIndex === -1 || createVariantModelEndIndex === -1
    ? ''
    : migrationSql.slice(createVariantModelIndex, createVariantModelEndIndex);
const updateVariantModelSql =
  updateVariantModelIndex === -1 || updateVariantModelEndIndex === -1
    ? ''
    : migrationSql.slice(updateVariantModelIndex, updateVariantModelEndIndex);

const variantSyncIndex = migrationSql.indexOf(
  'v_synced_variant_count := public.sync_product_variants_for_product'
);
const variantSyncStartIndex = migrationSql.lastIndexOf(
  'IF p_product_id IS NULL',
  variantSyncIndex
);
const variantSyncEndIndex = migrationSql.indexOf('END IF;', variantSyncIndex);
const variantSyncSql =
  variantSyncStartIndex === -1 || variantSyncEndIndex === -1
    ? ''
    : migrationSql.slice(
        variantSyncStartIndex,
        variantSyncEndIndex + 'END IF;'.length
      );
const serializedStockSyncIndex = migrationSql.indexOf(
  'PERFORM private.sync_serialized_stock'
);
const postSerializedStockSyncSql =
  serializedStockSyncIndex === -1
    ? ''
    : migrationSql.slice(serializedStockSyncIndex);
const createVariantIdStripIndex = migrationSql.indexOf(
  "jsonb_agg(element.raw - 'id' ORDER BY element.ordinal)"
);
const anchorTargetPreparationIndex = migrationSql.indexOf(
  'INTO v_reassign_anchor_variant'
);
const anchorPointerClearIndex = migrationSql.indexOf(
  'inventory_anchor_variant_id = NULL'
);
const anchorTransferIndex = migrationSql.indexOf(
  'UPDATE public.variant_inventory'
);
const hiddenAnchorDeleteIndex = migrationSql.search(
  /DELETE\s+FROM\s+public\.product_variants\s+WHERE\s+id\s*=\s*v_existing_anchor_id/i
);

export const mobileAdminProductRpcContract = {
  anchorPointerClearIndex,
  anchorTargetPreparationIndex,
  anchorTransferIndex,
  createVariantIdStripIndex,
  createVariantModelEndIndex,
  createVariantModelIndex,
  createVariantModelSql,
  hiddenAnchorDeleteIndex,
  latestRpcMigration,
  migrationFileName,
  migrationSql,
  productInsertSql,
  productPersistUpdateIndex,
  productPersistUpdateSql,
  productPersistenceSql,
  postSerializedStockSyncSql,
  publicRpcDefinitionPattern,
  rpcMigrationEntries,
  serializedStockSyncIndex,
  updateVariantModelEndIndex,
  updateVariantModelIndex,
  updateVariantModelSql,
  variantSyncIndex,
  variantSyncSql,
} as const;
