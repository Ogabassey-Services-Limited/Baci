import type {
  RestockUnitInput,
  VariantInventorySource,
} from '@/hooks/useVariantInventory';

export type RestockIdentifierMode = 'imei' | 'serial';
export type RestockSource = VariantInventorySource;

export const restockSourceLabels: Record<RestockSource, string> = {
  dropship: 'Dropship',
  merchant_stock: 'Merchant Stock',
  vendor_sourced: 'Vendor Sourced',
};

export const restockSources = [
  'merchant_stock',
  'vendor_sourced',
  'dropship',
] as const satisfies readonly RestockSource[];

export function parseRestockIdentifiers(inputText: string): string[] {
  return inputText
    .split(/[\n,]+/)
    .map((identifier) => identifier.trim())
    .filter(Boolean);
}

export function findInvalidImeis(identifiers: string[]): string[] {
  return identifiers.filter((imei) => !/^[0-9]{15}$/.test(imei));
}

export function buildRestockUnits({
  identifiers,
  mode,
  notes,
  source,
}: {
  identifiers: string[];
  mode: RestockIdentifierMode;
  notes: string;
  source: RestockSource;
}): RestockUnitInput[] {
  const trimmedNotes = notes.trim() || undefined;

  return identifiers.map((identifier) =>
    mode === 'imei'
      ? {
          imei: identifier,
          notes: trimmedNotes,
          source,
        }
      : {
          notes: trimmedNotes,
          serial: identifier,
          source,
        }
  );
}
