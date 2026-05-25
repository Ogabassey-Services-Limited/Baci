import { XMLParser } from 'fast-xml-parser';
import { z } from 'zod';
import {
  type PublicProductApiSample,
  type PublicProductComparableSurface,
  publicProductApiResponseSchema,
  publicProductComparableSurfaceSchema,
  publicProductCurrentFeedItemSchema,
  publicProductGoogleFeedItemSchema,
  publicProductPdpSchema,
} from '@/schemas/agent-commerce-public-product-parity';

export type PublicProductParityField =
  | 'availability'
  | 'image'
  | 'name'
  | 'price'
  | 'url';

export type {
  PublicProductApiSample,
  PublicProductComparableSurface,
} from '@/schemas/agent-commerce-public-product-parity';

export type PublicProductApiSampleSelection =
  | { kind: 'empty' }
  | { kind: 'invalid' }
  | { kind: 'unsupported' }
  | { kind: 'selected'; product: PublicProductApiSample };

export function selectPublicProductApiSample(
  payload: unknown
): PublicProductApiSampleSelection {
  const parsed = publicProductApiResponseSchema.safeParse(payload);
  if (!parsed.success) return { kind: 'invalid' };
  if (parsed.data.products.length === 0) return { kind: 'empty' };

  const product = parsed.data.products.find(
    (item) => !item.has_variants && !item.has_condition_offers
  );
  return product ? { kind: 'selected', product } : { kind: 'unsupported' };
}

export function parseCurrentAgentProductSample(
  body: string,
  productId: string
): PublicProductComparableSurface | null {
  for (const line of body.split('\n')) {
    if (!line.trim()) continue;

    try {
      const parsed = publicProductCurrentFeedItemSchema.safeParse(
        JSON.parse(line)
      );
      if (!parsed.success || parsed.data.id !== productId) continue;
      const item = parsed.data;
      const variant = item.variants[0];

      return publicProductComparableSurfaceSchema.parse({
        availability: variant.availability.status,
        image: item.media[0]?.url ?? '',
        name: item.title,
        price: variant.price.amount,
        url: item.url,
      });
    } catch (_error) {
      // Keep scanning JSONL lines when a non-sample line is malformed.
    }
  }

  return null;
}

function parsePrice(value: string | number) {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseGoogleMerchantProductSample(
  xml: string,
  productId: string
): PublicProductComparableSurface | null {
  try {
    const parser = new XMLParser({
      ignoreAttributes: true,
      parseTagValue: false,
      removeNSPrefix: true,
    });
    const parsed = z
      .object({
        rss: z.object({
          channel: z.object({
            item: z
              .union([
                publicProductGoogleFeedItemSchema,
                z.array(publicProductGoogleFeedItemSchema),
              ])
              .optional(),
          }),
        }),
      })
      .safeParse(parser.parse(xml));
    if (!parsed.success || !parsed.data.rss.channel.item) return null;

    const items = Array.isArray(parsed.data.rss.channel.item)
      ? parsed.data.rss.channel.item
      : [parsed.data.rss.channel.item];
    const item = items.find((candidate) => candidate.id === productId);
    if (!item) return null;
    const price = parsePrice(item.sale_price ?? item.price);
    if (price === null) return null;

    return publicProductComparableSurfaceSchema.parse({
      availability: item.availability,
      image: item.image_link,
      name: item.title,
      price,
      url: item.link,
    });
  } catch (_error) {
    return null;
  }
}

function getSchemaAvailability(value: string) {
  const normalized = value.trim().replace(/\/+$/, '').toLowerCase();
  if (
    normalized === 'instock' ||
    normalized === 'https://schema.org/instock' ||
    normalized === 'http://schema.org/instock'
  ) {
    return 'in_stock' as const;
  }
  if (
    normalized === 'outofstock' ||
    normalized === 'https://schema.org/outofstock' ||
    normalized === 'http://schema.org/outofstock'
  ) {
    return 'out_of_stock' as const;
  }
  return null;
}

export function parsePdpProductSample(
  html: string
): PublicProductComparableSurface | null {
  const scriptPattern =
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  for (const match of html.matchAll(scriptPattern)) {
    try {
      const parsed = publicProductPdpSchema.safeParse(JSON.parse(match[1]));
      if (!parsed.success) continue;
      const offer =
        parsed.data['@type'] === 'Product'
          ? parsed.data.offers
          : parsed.data.hasVariant[0].offers;
      const availability = getSchemaAvailability(offer.availability);
      const price = parsePrice(offer.price);
      if (!availability || price === null) continue;

      return publicProductComparableSurfaceSchema.parse({
        availability,
        image: Array.isArray(parsed.data.image)
          ? parsed.data.image[0]
          : parsed.data.image,
        name: parsed.data.name,
        price,
        url: parsed.data.url,
      });
    } catch (_error) {
      // Keep scanning script blocks when unrelated JSON-LD is malformed.
    }
  }

  return null;
}

export function comparePublicProductParitySurfaces({
  api,
  current,
  google,
  pdp,
}: {
  api: PublicProductApiSample;
  current: PublicProductComparableSurface;
  google: PublicProductComparableSurface;
  pdp: PublicProductComparableSurface;
}): PublicProductParityField[] {
  const fields: PublicProductParityField[] = [];
  const comparableFields = ['availability', 'image', 'name', 'price'] as const;

  for (const field of comparableFields) {
    if (
      current[field] !== api[field] ||
      google[field] !== api[field] ||
      pdp[field] !== api[field]
    ) {
      fields.push(field);
    }
  }
  if (google.url !== current.url || pdp.url !== current.url) fields.push('url');

  return fields;
}
