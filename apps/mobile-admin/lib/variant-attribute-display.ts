import type { VariantAttributeFormValue } from '@/lib/product-variant-form';

const META_ATTRIBUTE_KEYS = new Set(['color_hex', 'colour_hex']);
const META_ATTRIBUTE_SUFFIX = /_hex$/i;
const HEX_VALUE_PATTERN = /^#?[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?$/;
const COLOR_ATTRIBUTE_KEYS = new Set(['color', 'colour']);

// Named colours the platform can reliably render as a swatch. Multi-word
// marketing names ("Space Black", "Rose Gold") and unknown single words are
// intentionally excluded so they fall through to the numbered fallback rather
// than rendering a blank circle.
const RENDERABLE_COLOR_NAMES = new Set([
  'black',
  'white',
  'red',
  'green',
  'blue',
  'yellow',
  'orange',
  'purple',
  'pink',
  'gray',
  'grey',
  'brown',
  'gold',
  'silver',
  'beige',
  'navy',
  'teal',
  'cyan',
  'magenta',
  'maroon',
  'olive',
  'lime',
  'indigo',
  'violet',
  'turquoise',
  'tan',
  'coral',
  'crimson',
  'khaki',
  'ivory',
  'salmon',
]);

export interface IndexedVariantAttribute {
  attribute: VariantAttributeFormValue;
  index: number;
}

/**
 * Machine-oriented attribute keys (e.g. `color_hex`) that should never appear
 * as an editable key/value row — they leak the data model and overwhelm users.
 * They are kept in state so they still round-trip on save.
 */
export function isMetaAttributeKey(key: string): boolean {
  const normalized = key.trim().toLowerCase();
  return (
    META_ATTRIBUTE_KEYS.has(normalized) || META_ATTRIBUTE_SUFFIX.test(normalized)
  );
}

export function isColorAttributeKey(key: string): boolean {
  return COLOR_ATTRIBUTE_KEYS.has(key.trim().toLowerCase());
}

function normalizeHex(value: string): string | null {
  const trimmed = value.trim();
  if (!HEX_VALUE_PATTERN.test(trimmed)) {
    return null;
  }
  return trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
}

/**
 * Best-effort colour swatch for a variant: prefers an explicit `*_hex`
 * attribute, then falls back to a colour name the platform can render.
 */
export function getVariantSwatch(
  attributes: VariantAttributeFormValue[]
): string | null {
  for (const attribute of attributes) {
    const baseKey = attribute.key
      .trim()
      .toLowerCase()
      .replace(META_ATTRIBUTE_SUFFIX, '');
    if (isMetaAttributeKey(attribute.key) && COLOR_ATTRIBUTE_KEYS.has(baseKey)) {
      const hex = normalizeHex(attribute.value);
      if (hex) {
        return hex;
      }
    }
  }

  for (const attribute of attributes) {
    if (isColorAttributeKey(attribute.key)) {
      const name = attribute.value.trim().toLowerCase();
      if (RENDERABLE_COLOR_NAMES.has(name)) {
        return name;
      }
    }
  }

  return null;
}

/**
 * When a visible colour attribute is removed, its hidden `*_hex` companion
 * would otherwise be orphaned in the variant (still round-tripping to save and
 * driving a swatch for a colourless variant). Returns the indexes of the meta
 * attributes that should be removed alongside the colour at `index`.
 */
export function getPairedMetaAttributeIndexes(
  attributes: VariantAttributeFormValue[],
  index: number
): number[] {
  const target = attributes[index];
  if (!target || !isColorAttributeKey(target.key)) {
    return [];
  }

  const targetKey = target.key.trim().toLowerCase();
  const paired: number[] = [];
  attributes.forEach((attribute, attributeIndex) => {
    const metaKey = attribute.key.trim().toLowerCase();
    if (
      attributeIndex !== index &&
      isMetaAttributeKey(attribute.key) &&
      metaKey.replace(META_ATTRIBUTE_SUFFIX, '') === targetKey
    ) {
      paired.push(attributeIndex);
    }
  });

  return paired;
}

/**
 * Split a variant's attributes into the human-editable rows and the hidden
 * meta rows, preserving each attribute's real index so callbacks that operate
 * on the full array (add/update/remove) still target the right entry.
 */
export function partitionVariantAttributes(
  attributes: VariantAttributeFormValue[]
): { meta: IndexedVariantAttribute[]; visible: IndexedVariantAttribute[] } {
  const visible: IndexedVariantAttribute[] = [];
  const meta: IndexedVariantAttribute[] = [];

  attributes.forEach((attribute, index) => {
    if (isMetaAttributeKey(attribute.key)) {
      meta.push({ attribute, index });
    } else {
      visible.push({ attribute, index });
    }
  });

  return { meta, visible };
}
