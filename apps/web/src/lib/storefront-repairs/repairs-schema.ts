import type {
  RepairDeviceBrandGroup,
  RepairDeviceDetail,
  RepairQuoteSummary,
} from '@baci/shared/repairs';
import type { JsonLdStructuredData } from '@/lib/json-ld-types';

const SCHEMA_CONTEXT = 'https://schema.org';
const IN_STOCK = 'https://schema.org/InStock';

function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

/**
 * Store-level Organization `@id`, matching the home semantic graph
 * (`${storeUrl}/#online-store`) so the repair Service `provider` resolves to
 * the same node crawlers already know from the storefront home page.
 */
function organizationId(storeBaseUrl: string): string {
  return `${trimTrailingSlash(storeBaseUrl)}/#online-store`;
}

interface RepairsDeviceSchemaInput {
  merchantName: string;
  /** Storefront origin + optional path prefix (e.g. https://ogabassey.com). */
  storeBaseUrl: string;
  /** Absolute canonical device repair page URL. */
  deviceUrl: string;
  detail: RepairDeviceDetail;
  currency: string;
  /** Country name for `areaServed` (optional). */
  areaServed?: string | null;
}

function buildOffer(
  quote: RepairQuoteSummary,
  currency: string
): Record<string, unknown> {
  const offer: Record<string, unknown> = {
    '@type': 'Offer',
    priceCurrency: currency,
    availability: IN_STOCK,
  };

  if (quote.isFromPrice) {
    // "From ₦X" — the quoted price is a floor, not a fixed price.
    offer.priceSpecification = {
      '@type': 'PriceSpecification',
      priceCurrency: currency,
      minPrice: quote.price,
    };
  } else {
    offer.price = quote.price;
  }

  return offer;
}

function buildServiceNode(
  quote: RepairQuoteSummary,
  args: {
    deviceLabel: string;
    deviceUrl: string;
    storeBaseUrl: string;
    currency: string;
    areaServed?: string | null;
    productUrl: string | null;
    productName: string | null;
  }
): Record<string, unknown> {
  const node: Record<string, unknown> = {
    '@type': 'Service',
    '@id': `${args.deviceUrl}#repair-${quote.id}`,
    name: `${args.deviceLabel} ${quote.serviceTypeName}`.trim(),
    serviceType: quote.serviceTypeName,
    provider: { '@id': organizationId(args.storeBaseUrl) },
  };

  if (args.areaServed) {
    node.areaServed = { '@type': 'Country', name: args.areaServed };
  }

  if (quote.description) {
    node.description = quote.description;
  }

  // Semantic link: this repair service relates to the device Product page,
  // whose Product node carries product_key_specs. Lets AI agents connect the
  // device's specs to its repair parts/prices.
  if (args.productUrl) {
    node.isRelatedTo = {
      '@type': 'Product',
      '@id': args.productUrl,
      url: args.productUrl,
      name: args.productName ?? args.deviceLabel,
    };
  }

  node.offers = buildOffer(quote, args.currency);

  return node;
}

/**
 * Per-device `OfferCatalog` of repair `Service` nodes. Returns null when the
 * device has no active quotes (no catalog to advertise).
 */
export function buildRepairsDeviceSchema(
  input: RepairsDeviceSchemaInput
): JsonLdStructuredData | null {
  const {
    areaServed,
    currency,
    detail,
    deviceUrl,
    merchantName,
    storeBaseUrl,
  } = input;

  if (detail.quotes.length === 0) {
    return null;
  }

  const deviceLabel = `${detail.device.brand} ${detail.device.model}`.trim();
  const productUrl = detail.product?.slug
    ? `${trimTrailingSlash(storeBaseUrl)}/products/${detail.product.slug}`
    : null;

  const services = detail.quotes.map((quote) =>
    buildServiceNode(quote, {
      areaServed,
      currency,
      deviceLabel,
      deviceUrl,
      productName: detail.product?.name ?? null,
      productUrl,
      storeBaseUrl,
    })
  );

  return {
    '@context': SCHEMA_CONTEXT,
    '@type': 'OfferCatalog',
    '@id': `${deviceUrl}#repair-catalog`,
    name: `${deviceLabel} repair services`,
    url: deviceUrl,
    provider: {
      '@type': 'Organization',
      '@id': organizationId(storeBaseUrl),
      name: merchantName,
    },
    itemListElement: services,
  };
}

interface RepairsIndexSchemaInput {
  merchantName: string;
  storeBaseUrl: string;
  /** Absolute `/repairs` index URL. */
  repairsUrl: string;
  groups: RepairDeviceBrandGroup[];
}

/**
 * `/[slug]/repairs` index `ItemList` of device repair pages. Returns null when
 * there are no devices to list.
 */
export function buildRepairsIndexSchema(
  input: RepairsIndexSchemaInput
): JsonLdStructuredData | null {
  const { groups, merchantName, repairsUrl } = input;
  const devices = groups.flatMap((group) => group.devices);

  if (devices.length === 0) {
    return null;
  }

  const normalizedRepairsUrl = trimTrailingSlash(repairsUrl);

  return {
    '@context': SCHEMA_CONTEXT,
    '@type': 'ItemList',
    '@id': `${repairsUrl}#repair-devices`,
    name: `${merchantName} device repair catalog`,
    url: repairsUrl,
    numberOfItems: devices.length,
    itemListElement: devices.map((device, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: `${device.brand} ${device.model}`.trim(),
      item: `${normalizedRepairsUrl}/${device.slug}`,
    })),
  };
}
