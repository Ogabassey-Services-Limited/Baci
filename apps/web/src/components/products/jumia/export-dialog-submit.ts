import { fetchWithCsrf } from '@/lib/api-client';
import { sanitizeText, stripHtmlTags } from '@/lib/sanitize-core';

type ExportResponse =
  | { success: true; feedId: string }
  | { success: false; error: string; feedErrors?: string[] };

type SubmitJumiaExportParams = {
  product: {
    id: string;
    sku: string;
    name: string;
    description: string;
    price: number;
    images?: string[];
  };
  merchantId: string;
  integrationId: string;
  categoryCode: number;
  brand: { code: number; name: string };
};

type ExportResult =
  | { ok: true; feedId: string }
  | { ok: false; message: string };

const MAX_DISPLAYED_FEED_ERRORS = 3;
const MAX_FEED_ERROR_LENGTH = 200;
const MAX_TOTAL_FEED_ERROR_LENGTH = 500;

function buildFeedErrorDetail(feedErrors: string[] | undefined): string {
  if (!feedErrors || feedErrors.length === 0) {
    return '';
  }

  const displayed = feedErrors.slice(0, MAX_DISPLAYED_FEED_ERRORS).map((e) => {
    const safe = sanitizeText(e);
    return safe.length > MAX_FEED_ERROR_LENGTH
      ? `${safe.slice(0, MAX_FEED_ERROR_LENGTH)}...`
      : safe;
  });

  let detail = `\n${displayed.join('\n')}`;
  if (feedErrors.length > MAX_DISPLAYED_FEED_ERRORS) {
    detail += `\n... (${feedErrors.length - MAX_DISPLAYED_FEED_ERRORS} more errors)`;
  }
  return detail;
}

function buildExportPayload({
  product,
  merchantId,
  integrationId,
  categoryCode,
  brand,
}: SubmitJumiaExportParams) {
  return {
    integrationId,
    merchantId,
    productId: product.id,
    name: sanitizeText(stripHtmlTags(product.name)),
    brand: {
      code: brand.code,
      name: sanitizeText(stripHtmlTags(brand.name)),
    },
    category: { code: categoryCode },
    description: sanitizeText(
      stripHtmlTags(product.description || product.name)
    ),
    images: (product.images ?? [])
      .filter((url) => {
        if (!url) return false;
        try {
          const parsed = new URL(url);
          return parsed.protocol === 'http:' || parsed.protocol === 'https:';
        } catch {
          return false;
        }
      })
      .map((url, i) => ({
        url,
        primary: i === 0,
      })),
    variations: [
      {
        sellerSku: product.sku,
        price: product.price,
        // NGN is Nigeria-pilot specific; derive from merchant config when multi-country support is added
        currency: 'NGN',
      },
    ],
  };
}

/** Submit one sanitized product payload to the Jumia export endpoint. */
export async function submitJumiaExport(
  params: SubmitJumiaExportParams
): Promise<ExportResult> {
  const res = await fetchWithCsrf('/api/marketplace/jumia/products/export', {
    method: 'POST',
    body: JSON.stringify(buildExportPayload(params)),
  });

  if (!res.ok) {
    let message = res.statusText || 'Export failed';
    try {
      const errorBody = await res.json();
      if (errorBody.error) message = errorBody.error;
    } catch {
      // Response body is not JSON, use statusText
    }
    return { ok: false, message };
  }

  let data: ExportResponse;
  try {
    data = await res.json();
  } catch {
    return { ok: false, message: 'Invalid response from server' };
  }

  if (!data.success) {
    const feedDetail = buildFeedErrorDetail(data.feedErrors);
    let message = sanitizeText(data.error || 'Export failed') + feedDetail;
    if (message.length > MAX_TOTAL_FEED_ERROR_LENGTH) {
      message = `${message.slice(0, MAX_TOTAL_FEED_ERROR_LENGTH)}... (truncated)`;
    }
    return { ok: false, message };
  }

  return { ok: true, feedId: data.feedId };
}
