import { XMLParser } from 'fast-xml-parser';
import {
  type PublicProductComparableSurface,
  publicProductComparableSurfaceSchema,
  publicProductGoogleFeedItemSchema,
} from '@/schemas/agent-commerce-public-product-parity';

const GOOGLE_ITEM_OPEN_TAG = '<item>';
const GOOGLE_ITEM_CLOSE_TAG = '</item>';
const MAX_GOOGLE_ITEM_XML_LENGTH = 1024 * 1024;

function getObjectField(value: unknown, key: string): unknown {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined;
  }

  return (value as Record<string, unknown>)[key];
}

function parsePrice(value: string | number) {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseGoogleMerchantProductItem(
  itemXml: string,
  productId: string
): PublicProductComparableSurface | null {
  try {
    const parser = new XMLParser({
      ignoreAttributes: true,
      parseTagValue: false,
      removeNSPrefix: true,
    });
    const parsed = publicProductGoogleFeedItemSchema.safeParse(
      getObjectField(parser.parse(itemXml), 'item')
    );
    if (
      !parsed.success ||
      (parsed.data.id !== productId && parsed.data.item_group_id !== productId)
    ) {
      return null;
    }
    const item = parsed.data;
    const price = parsePrice(item.sale_price ?? item.price);
    if (price === null) return null;
    const isGroupedVariant =
      item.id !== productId && item.item_group_id === productId;

    return publicProductComparableSurfaceSchema.parse({
      availability: item.availability,
      ...(isGroupedVariant ? { catalog_scope: 'variant' as const } : {}),
      image: item.image_link,
      name: item.title,
      price,
      // Variant Google feed entries use g:link for the purchasable SKU and
      // g:canonical_link for the parent PDP; parity compares parent surfaces.
      url: item.canonical_link ?? item.link,
    });
  } catch (_error) {
    return null;
  }
}

export function parseGoogleMerchantProductSample(
  xml: string,
  productId: string
): PublicProductComparableSurface | null {
  let offset = 0;
  while (offset < xml.length) {
    const start = xml.indexOf(GOOGLE_ITEM_OPEN_TAG, offset);
    if (start === -1) return null;
    const end = xml.indexOf(
      GOOGLE_ITEM_CLOSE_TAG,
      start + GOOGLE_ITEM_OPEN_TAG.length
    );
    if (end === -1) return null;
    const itemEnd = end + GOOGLE_ITEM_CLOSE_TAG.length;
    const itemXml = xml.slice(start, itemEnd);
    if (itemXml.length <= MAX_GOOGLE_ITEM_XML_LENGTH) {
      const sample = parseGoogleMerchantProductItem(itemXml, productId);
      if (sample) return sample;
    }
    offset = itemEnd;
  }

  return null;
}

export async function parseGoogleMerchantProductSampleStream(
  stream: ReadableStream<Uint8Array> | null,
  productId: string
): Promise<PublicProductComparableSurface | null> {
  if (!stream) return null;

  const decoder = new TextDecoder();
  const reader = stream.getReader();
  let pending = '';
  let skipOversizedItem = false;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      pending += decoder.decode(value, { stream: !done });

      for (;;) {
        if (skipOversizedItem) {
          const skippedEnd = pending.indexOf(GOOGLE_ITEM_CLOSE_TAG);
          if (skippedEnd === -1) {
            pending = pending.slice(-(GOOGLE_ITEM_CLOSE_TAG.length - 1));
            break;
          }
          pending = pending.slice(skippedEnd + GOOGLE_ITEM_CLOSE_TAG.length);
          skipOversizedItem = false;
        }

        const start = pending.indexOf(GOOGLE_ITEM_OPEN_TAG);
        if (start === -1) {
          pending = pending.slice(-(GOOGLE_ITEM_OPEN_TAG.length - 1));
          break;
        }
        const end = pending.indexOf(
          GOOGLE_ITEM_CLOSE_TAG,
          start + GOOGLE_ITEM_OPEN_TAG.length
        );
        if (end === -1) {
          pending = pending.slice(start);
          if (pending.length > MAX_GOOGLE_ITEM_XML_LENGTH) {
            pending = pending.slice(-(GOOGLE_ITEM_CLOSE_TAG.length - 1));
            skipOversizedItem = true;
          }
          break;
        }
        const itemEnd = end + GOOGLE_ITEM_CLOSE_TAG.length;
        const itemXml = pending.slice(start, itemEnd);
        pending = pending.slice(itemEnd);
        if (itemXml.length > MAX_GOOGLE_ITEM_XML_LENGTH) continue;

        const sample = parseGoogleMerchantProductItem(itemXml, productId);
        if (sample) {
          await reader.cancel().catch(() => undefined);
          return sample;
        }
      }

      if (done) return null;
    }
  } finally {
    reader.releaseLock();
  }
}
