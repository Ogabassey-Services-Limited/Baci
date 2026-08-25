import { getAllProducts } from '@/lib/jumia/catalog';
import type { JumiaClient } from '@/lib/jumia/client';
import { logger } from '@/lib/logger';

type LoadJumiaImportContextArgs = {
  createJumiaClient: () => Promise<JumiaClient>;
};

type LoadJumiaImportContextResult =
  | {
      ok: true;
      jumia: Awaited<ReturnType<typeof JumiaClient.forIntegration>>;
      jumiaProducts: Awaited<ReturnType<typeof getAllProducts>>;
    }
  | {
      ok: false;
      error: string;
      status: 403 | 404 | 500 | 502;
    };

export async function loadJumiaImportContext({
  createJumiaClient,
}: LoadJumiaImportContextArgs): Promise<LoadJumiaImportContextResult> {
  let jumia: Awaited<ReturnType<typeof JumiaClient.forIntegration>>;
  try {
    jumia = await createJumiaClient();
  } catch (err) {
    if (
      typeof err === 'object' &&
      err !== null &&
      'status' in err &&
      typeof err.status === 'number'
    ) {
      if (err.status === 404) {
        return { ok: false, error: 'Integration not found', status: 404 };
      }
      if (err.status === 403 || err.status === 401) {
        return { ok: false, error: 'Forbidden', status: 403 };
      }
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error({
      message: 'Failed to initialize Jumia client',
      error: message,
    });
    return {
      ok: false,
      error: 'Failed to initialize Jumia client',
      status: 500,
    };
  }

  try {
    const productQuery = {
      status: 'active' as const,
      ...(jumia.shopId === 'oauth' ? {} : { shopId: jumia.shopId }),
    };
    const jumiaProducts = await getAllProducts(jumia, productQuery);
    return { ok: true, jumia, jumiaProducts };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error({
      message: 'Failed to fetch products from Jumia',
      error: message,
    });
    return {
      ok: false,
      error: 'Failed to fetch products from Jumia',
      status: 502,
    };
  }
}
