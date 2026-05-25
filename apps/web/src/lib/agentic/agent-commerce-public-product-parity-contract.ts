import { XMLParser } from 'fast-xml-parser';
import { z } from 'zod';

const availabilitySchema = z.enum(['in_stock', 'out_of_stock']);

const apiProductSchema = z.object({
  availability: availabilitySchema,
  has_condition_offers: z.boolean(),
  has_variants: z.boolean(),
  id: z.string().min(1),
  image: z.string(),
  name: z.string().min(1),
  price: z.number(),
});

const apiResponseSchema = z.object({
  products: z.array(apiProductSchema),
});

const comparableSurfaceSchema = z.object({
  availability: availabilitySchema,
  image: z.string(),
  name: z.string().min(1),
  price: z.number(),
  url: z.string().url(),
});

const currentFeedItemSchema = z.object({
  id: z.string().min(1),
  media: z.array(z.object({ url: z.string() })),
  title: z.string().min(1),
  url: z.string().url(),
  variants: z
    .array(
      z.object({
        availability: z.object({ status: availabilitySchema }),
        price: z.object({ amount: z.number() }),
      })
    )
    .min(1),
});

const googleFeedItemSchema = z.object({
  availability: availabilitySchema,
  id: z.string().min(1),
  image_link: z.string(),
  link: z.string().url(),
  price: z.string(),
  sale_price: z.string().optional(),
  title: z.string().min(1),
});

const pdpProductSchema = z.object({
  '@type': z.literal('Product'),
  image: z.union([z.string(), z.array(z.string()).min(1)]),
  name: z.string().min(1),
  offers: z.object({
    availability: z.string(),
    price: z.union([z.number(), z.string()]),
    url: z.string().url(),
  }),
  url: z.string().url(),
});

export type PublicProductParityField =
  | 'availability'
  | 'image'
  | 'name'
  | 'price'
  | 'url';

export type PublicProductApiSample = z.infer<typeof apiProductSchema>;
export type PublicProductComparableSurface = z.infer<
  typeof comparableSurfaceSchema
>;

export type PublicProductApiSampleSelection =
  | { kind: 'empty' }
  | { kind: 'invalid' }
  | { kind: 'unsupported' }
  | { kind: 'selected'; product: PublicProductApiSample };

export function selectPublicProductApiSample(
  payload: unknown
): PublicProductApiSampleSelection {
  const parsed = apiResponseSchema.safeParse(payload);
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
      const parsed = currentFeedItemSchema.safeParse(JSON.parse(line));
      if (!parsed.success || parsed.data.id !== productId) continue;
      const item = parsed.data;
      const variant = item.variants[0];

      return comparableSurfaceSchema.parse({
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
              .union([googleFeedItemSchema, z.array(googleFeedItemSchema)])
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

    return comparableSurfaceSchema.parse({
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
  if (value === 'https://schema.org/InStock') return 'in_stock' as const;
  if (value === 'https://schema.org/OutOfStock') return 'out_of_stock' as const;
  return null;
}

export function parsePdpProductSample(
  html: string
): PublicProductComparableSurface | null {
  const scriptPattern =
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  for (const match of html.matchAll(scriptPattern)) {
    try {
      const parsed = pdpProductSchema.safeParse(JSON.parse(match[1]));
      if (!parsed.success) continue;
      const availability = getSchemaAvailability(
        parsed.data.offers.availability
      );
      const price = parsePrice(parsed.data.offers.price);
      if (!availability || price === null) return null;

      return comparableSurfaceSchema.parse({
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
