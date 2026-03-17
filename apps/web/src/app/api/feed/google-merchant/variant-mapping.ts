/**
 * GMC variant attribute mapping.
 *
 * Maps Ogabassey's flexible JSONB variant attributes to Google Merchant
 * Center's fixed variant fields, and builds `<g:product_detail>` XML
 * from structured key_specs data.
 */

export interface GmcVariantAttributes {
  color?: string;
  size?: string;
}

export interface FeedKeySpecs {
  ram_gb?: number;
  storage_gb?: number;
  screen_size_inches?: number;
  chipset?: string;
  battery_mah?: number;
  main_camera_mp?: number;
}

/**
 * Map Ogabassey variant attributes to GMC variant fields.
 *
 * Mapping rules (industry standard for electronics):
 * - `color` → `<g:color>`
 * - `storage` → `<g:size>` (how Google Store, Samsung, Shopify do it)
 * - `size` → `<g:size>` (tablets/laptops)
 * - When both `storage` and `size` exist, concatenate: "256GB / 10.1 inch"
 * - All other attributes (ram, sim_type, connectivity, platform) are NOT
 *   variant-defining — they go to product_detail if anywhere.
 */
export function mapVariantToGmcAttributes(
  attributes: Record<string, string>
): GmcVariantAttributes {
  const result: GmcVariantAttributes = {};

  const color = attributes.color?.trim();
  if (color) {
    result.color = color;
  }

  const storage = attributes.storage?.trim();
  const size = attributes.size?.trim();

  if (storage && size) {
    result.size = `${storage} / ${size}`;
  } else if (storage) {
    result.size = storage;
  } else if (size) {
    result.size = size;
  }

  return result;
}

/**
 * Returns true if the attributes contain at least one GMC-mappable variant axis.
 */
export function hasGmcVariantAxis(attributes: Record<string, string>): boolean {
  const mapped = mapVariantToGmcAttributes(attributes);
  return mapped.color !== undefined || mapped.size !== undefined;
}

const SPEC_SECTIONS: Array<{
  key: keyof FeedKeySpecs;
  section: string;
  label: string;
  format: (value: number | string) => string;
}> = [
  {
    key: 'ram_gb',
    section: 'Performance',
    label: 'RAM',
    format: (v) => `${v}GB`,
  },
  {
    key: 'storage_gb',
    section: 'Storage',
    label: 'Storage Capacity',
    format: (v) => `${v}GB`,
  },
  {
    key: 'screen_size_inches',
    section: 'Display',
    label: 'Screen Size',
    format: (v) => `${v} inches`,
  },
  {
    key: 'chipset',
    section: 'Performance',
    label: 'Processor',
    format: (v) => String(v),
  },
  {
    key: 'battery_mah',
    section: 'Battery',
    label: 'Battery',
    format: (v) => `${v} mAh`,
  },
  {
    key: 'main_camera_mp',
    section: 'Camera',
    label: 'Main Camera',
    format: (v) => `${v} MP`,
  },
];

/** Escape XML special characters to prevent malformed feed output. */
function escapeXmlValue(unsafe: string): string {
  if (!unsafe) return '';
  return unsafe
    .toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Build `<g:product_detail>` XML entries from structured key_specs.
 *
 * Only the 6 whitelisted key_specs columns are emitted. Non-GMC variant
 * attributes (sim_type, connectivity, etc.) are NOT emitted as product_detail.
 */
export function buildProductDetailXml(keySpecs: FeedKeySpecs): string {
  const entries: string[] = [];

  for (const spec of SPEC_SECTIONS) {
    const value = keySpecs[spec.key];
    if (value == null) continue;

    entries.push(
      `        <g:product_detail>\n` +
        `          <g:section_name>${escapeXmlValue(spec.section)}</g:section_name>\n` +
        `          <g:attribute_name>${escapeXmlValue(spec.label)}</g:attribute_name>\n` +
        `          <g:attribute_value>${escapeXmlValue(spec.format(value))}</g:attribute_value>\n` +
        `        </g:product_detail>`
    );
  }

  return entries.join('\n');
}
