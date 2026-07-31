import { fetchWithCsrf } from '@/lib/api-client';

export interface ProductCsvImportResultData {
  success: number;
  failed: number;
  errors: string[];
}

export type ProductCsvUploadResult =
  | { status: 'ok'; data: ProductCsvImportResultData }
  | { status: 'error'; error: unknown };

const BULK_IMPORT_TIMEOUT_MS = 30_000;

export async function uploadProductCsv(
  file: File
): Promise<ProductCsvUploadResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    BULK_IMPORT_TIMEOUT_MS
  );

  try {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetchWithCsrf('/api/products/bulk-import', {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error('Upload failed');
    }
    const data = (await response.json()) as ProductCsvImportResultData;
    return { status: 'ok', data };
  } catch (error) {
    return { status: 'error', error };
  } finally {
    clearTimeout(timeoutId);
  }
}
