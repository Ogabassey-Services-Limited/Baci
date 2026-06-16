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
  return identifiers.filter((imei) => !isValidImei(imei));
}

function isValidImei(imei: string): boolean {
  if (!/^[0-9]{15}$/.test(imei)) {
    return false;
  }

  let sum = 0;
  for (let index = 0; index < imei.length; index += 1) {
    let digit = Number.parseInt(imei[index] ?? '', 10);
    if (index % 2 === 1) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    sum += digit;
  }

  return sum % 10 === 0;
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
