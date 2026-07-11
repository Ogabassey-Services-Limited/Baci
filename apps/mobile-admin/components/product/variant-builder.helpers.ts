import type {
  VariantOptionDraft,
  VariantOptionValueDraft,
} from '@/lib/variant-generation';

// Common attribute names merchants reach for first when defining variants.
export const VARIANT_OPTION_NAME_SUGGESTIONS = [
  'Color',
  'Storage',
  'RAM',
  'Size',
  'Material',
] as const;

let optionToken = 0;

function nextToken(prefix: string): string {
  optionToken += 1;
  return `${prefix}-${optionToken}`;
}

export function createVariantOptionValueDraft(
  value = ''
): VariantOptionValueDraft {
  return { id: nextToken('variant-option-value'), value };
}

export function createVariantOptionDraft(name = ''): VariantOptionDraft {
  return { id: nextToken('variant-option'), name, values: [] };
}
