export const PRODUCT_DESCRIPTION_WRITER_INVENTORY_HEADER =
  'inventory_version,path,caller_or_route,operation,description_input_contract,can_attest_source,unattested_source,guard_error_contract,test_path,file_sha256';

export type ProductDescriptionWriterInventoryColumn =
  | 'inventory_version'
  | 'path'
  | 'caller_or_route'
  | 'operation'
  | 'description_input_contract'
  | 'can_attest_source'
  | 'unattested_source'
  | 'guard_error_contract'
  | 'test_path'
  | 'file_sha256';
export type ProductDescriptionWriterInventoryRow = Record<
  ProductDescriptionWriterInventoryColumn,
  string
>;
export type CheckResult = { errors: string[]; ok: boolean };

export const INVENTORY_COLUMNS =
  PRODUCT_DESCRIPTION_WRITER_INVENTORY_HEADER.split(
    ','
  ) as ProductDescriptionWriterInventoryColumn[];
export const TS_ROOTS = [
  'apps/web/src',
  'apps/web/mcp-server',
  'apps/web/scripts-tmp',
  'apps/mobile-admin',
  'apps/mobile-storefront',
  'packages',
  'supabase/functions',
];
export const TS_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts']);
export const DEFAULT_FILE_READ_CONCURRENCY = 32;
export const UNATTESTED = 'unattested_pending_C2b';
export const GUARD =
  'C3 prepared guard not installed; stable error mapping pending';
export const EXPECTED_INVENTORY_FIELDS = {
  inventory_version: '1',
  can_attest_source: 'no',
  unattested_source: UNATTESTED,
  guard_error_contract: GUARD,
} as const;

const HASHES: Record<string, string> = {
  'apps/web/src/schemas/products.ts':
    'ce02c458edf20d90f7ea395df926473542406addca46e917912ef7ae66f17b5f',
  'apps/web/src/app/dashboard/products/add/add-product-form.tsx':
    '1742d39c6f45ffb1db3051252a1348018e9de681ea02d831e1ad79ff920bdd7f',
  'apps/web/src/app/api/products/route.ts':
    '333c0f88c0e935d9b9b7596db207732d0e59a1ff953dea92ef6a2e84ab060584',
  'apps/web/src/app/api/products/create-product.ts':
    'a3f477c37f68e72ed054c1eeef785c5f9cf8c15db620b826e602339d36e8174f',
  'apps/web/src/app/api/products/[id]/route.ts':
    'bbf6b4b564e4d9bf1c085d8139450ed7340fa94f008b5d6a00f9f08502d71e83',
  'apps/web/src/components/products/csv-bulk-import-dialog.tsx':
    'ebcf3dfa786f49243b6fa7a64caa451ebaea4097529b26394e26cf05da48fe4d',
  'apps/web/src/app/api/products/bulk-import/route.ts':
    '15d0d8675b95a5292cbf49df78311c96ab9f6423a5102fea9cca23ba0ff2274f',
  'apps/web/src/components/products/review-changes.tsx':
    'c6e4a42e07025b9b65a3ff33eb2e0c4732e5814270b0597051ab25573428b93b',
  'apps/web/src/contexts/product-context.tsx':
    '3e47398edc8a6109058d847bef93392f3950f25fd446e3c95601d1ff7dcb5743',
  'apps/web/src/app/api/products/bulk-update/route.ts':
    '0e71cbf869330b065bfe2909e7b0d213d9af247495a810e8f6fae4b4080ca1ef',
  'apps/web/src/app/api/products/bulk-update/bulk-update-change-processing.ts':
    '2c2ee0dc3e64187880ef5f707ba0c6eac4343e9bd192671628191fb0b3d0482f',
  'apps/web/src/lib/import-jobs/run-claimed-import-job.ts':
    '8652502134b8c7912dd28c870a708c1290b51702fac6a3de171ae4c4e2a0483c',
  'apps/web/src/lib/import-commit/commit-bumpa-products.ts':
    'c3f98397d19843877418fe91a1162d8372079b56acf81ebdd68fd657fed1a541',
  'apps/web/src/app/dashboard/products/use-products-page-actions.ts':
    '38f752fb0e755715a1b5202148fa5f95a22a40b6380244d90db6406fff145a49',
  'apps/web/src/app/api/marketplace/jumia/products/import/route.ts':
    '813253bdbd7ebfe974b5fc227a03a004fb542312e0a6e11beda1ced99878f4b2',
  'apps/mobile-admin/hooks/product-save.ts':
    'b30f9431b0c7968880e3ce4d7b55db74a72afaa07e09ab2cab72c275994b4558',
  'supabase/migrations/20260615181534_serialized_variant_inventory.sql':
    'd0f34aeab2a0622c0cae17dbd260c671cc6c96db31f85d414fb19beabb11fce8',
  'supabase/migrations/20260702063638_restore_mobile_admin_product_rpc_contract.sql':
    'a04858072ce04f37af2269bb14bd4a936df612b6243fdb0099e8b417ba9c3ba4',
  'apps/web/src/ai/flows/generate-product-descriptions.ts':
    '2d75d5427336ed5db57afe4f174ec1db18e09ce5a36edfde08e23eed380d1fc7',
  'apps/web/src/ai/flows/autofill-product-details.ts':
    'c2e08bc974fd4e485c4ce75af674831204f3712d4a0351dfabc655911731f771',
};

const row = (
  path: string,
  caller: string,
  operation: string,
  contract: string,
  test: string
): ProductDescriptionWriterInventoryRow => {
  const fileSha256 = HASHES[path];
  if (!fileSha256) {
    throw new Error(`Missing canonical product description writer hash: ${path}`);
  }

  return {
    inventory_version: '1',
    path,
    caller_or_route: caller,
    operation,
    description_input_contract: contract,
    can_attest_source: 'no',
    unattested_source: UNATTESTED,
    guard_error_contract: GUARD,
    test_path: test,
    file_sha256: fileSha256,
  };
};

export const CURRENT_INVENTORY_ROWS = [
  row(
    'apps/web/src/schemas/products.ts',
    'web create/update route schemas',
    'description contract',
    'create/update description schema',
    'apps/web/src/schemas/products.test.ts'
  ),
  row(
    'apps/web/src/app/dashboard/products/add/add-product-form.tsx',
    'add/edit form; AI result -> submitted product',
    'AI persistence caller',
    'form description including generated text',
    'apps/web/src/app/dashboard/products/add/add-product-form.test.tsx'
  ),
  row(
    'apps/web/src/app/api/products/route.ts',
    'add form -> POST /api/products',
    'insert public.products.description',
    'createProductSchema description',
    'apps/web/src/app/api/products/route.test.ts'
  ),
  row(
    'apps/web/src/app/api/products/create-product.ts',
    'POST /api/products handler',
    'insert public.products.description',
    'createProductSchema description',
    'apps/web/src/app/api/products/create-product.test.ts'
  ),
  row(
    'apps/web/src/app/api/products/[id]/route.ts',
    'edit form -> PUT /api/products/[id]',
    'update public.products.description',
    'updateProductSchema description',
    'apps/web/src/app/api/products/[id]/route.test.ts'
  ),
  row(
    'apps/web/src/components/products/csv-bulk-import-dialog.tsx',
    'CSV dialog -> multipart import route',
    'CSV persistence caller',
    'CSV description column',
    'apps/web/src/components/products/csv-bulk-import-dialog.test.tsx'
  ),
  row(
    'apps/web/src/app/api/products/bulk-import/route.ts',
    'CSV dialog -> bulk import route',
    'insert public.products.description',
    'optional CSV description',
    'apps/web/src/app/api/products/bulk-import/route.test.ts'
  ),
  row(
    'apps/web/src/components/products/review-changes.tsx',
    'review UI -> product context',
    'bulk-update persistence caller',
    'BulkUpdateChange description',
    'apps/web/src/components/products/review-changes.test.tsx'
  ),
  row(
    'apps/web/src/contexts/product-context.tsx',
    'review UI -> bulk-update route',
    'bulk-update persistence caller',
    'product change description',
    'apps/web/src/contexts/product-context.test.tsx'
  ),
  row(
    'apps/web/src/app/api/products/bulk-update/route.ts',
    'product context -> bulk processor',
    'bulk-update route caller',
    'validated change description',
    'apps/web/src/app/api/products/bulk-update/route.test.ts'
  ),
  row(
    'apps/web/src/app/api/products/bulk-update/bulk-update-change-processing.ts',
    'bulk-update route -> processor',
    'insert public.products.description',
    'new change details.description',
    'apps/web/src/app/api/products/bulk-update/bulk-update-change-processing.test.ts'
  ),
  row(
    'apps/web/src/lib/import-jobs/run-claimed-import-job.ts',
    'claimed Bumpa job -> commit helper',
    'Bumpa persistence caller',
    'normalized product description',
    'apps/web/src/lib/import-jobs/run-claimed-import-job.test.ts'
  ),
  row(
    'apps/web/src/lib/import-commit/commit-bumpa-products.ts',
    'Bumpa commit helper',
    'insert/update public.products.description',
    'NormalizedImportedProduct.description',
    'apps/web/src/lib/import-commit/commit-bumpa-products.test.ts'
  ),
  row(
    'apps/web/src/app/dashboard/products/use-products-page-actions.ts',
    'dashboard action -> Jumia import',
    'Jumia persistence caller',
    'Jumia imported description',
    'apps/web/src/app/dashboard/products/use-products-page-actions.test.ts'
  ),
  row(
    'apps/web/src/app/api/marketplace/jumia/products/import/route.ts',
    'dashboard action -> Jumia import',
    'upsert public.products.description',
    'sanitized Jumia description',
    'apps/web/src/app/api/marketplace/jumia/products/import/route.test.ts'
  ),
  row(
    'apps/mobile-admin/hooks/product-save.ts',
    'mobile create/update -> public RPC',
    'RPC persistence caller',
    'ProductDbSchema payload description',
    'apps/mobile-admin/hooks/product-save.test.ts'
  ),
  row(
    'supabase/migrations/20260615181534_serialized_variant_inventory.sql',
    'legacy private mobile product-save RPC',
    'insert/update public.products.description',
    'p_product_payload.description',
    'apps/mobile-admin/hooks/product-save.test.ts'
  ),
  row(
    'supabase/migrations/20260702063638_restore_mobile_admin_product_rpc_contract.sql',
    'mobile hook -> current public RPC',
    'insert/update public.products.description',
    'p_product_payload.description',
    'apps/mobile-admin/hooks/product-save.test.ts'
  ),
  row(
    'apps/web/src/ai/flows/generate-product-descriptions.ts',
    'add/edit form server action',
    'generate only; persisted by add form',
    'GenerateProductDescriptionInput -> text',
    'apps/web/src/ai/flows/generate-product-descriptions.test.ts'
  ),
  row(
    'apps/web/src/ai/flows/autofill-product-details.ts',
    'add/edit form server action',
    'generate only; persisted by add form',
    'Autofill input -> details.description',
    'apps/web/src/ai/flows/autofill-product-details.test.ts'
  ),
];

export const CURRENT_INVENTORY_ROWS_BY_PATH = new Map(
  CURRENT_INVENTORY_ROWS.map((entry) => [entry.path, entry])
);
