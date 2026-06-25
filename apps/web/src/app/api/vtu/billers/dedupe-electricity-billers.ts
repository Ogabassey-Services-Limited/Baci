import { resolveProviderRateKey } from '@/lib/vtu-commission-rates';
import type { NormalizedBiller } from './biller-normalizers';

// "Kuda display + Monnify fulfillment" for electricity: collapse each DISCO to
// the Kuda card (logo + short name + single Prepaid/Postpaid entry) and attach
// the matching Monnify pre/post billerCode+productCode onto each Kuda bill item.
// The vend auto-router then fulfills via Monnify (instant) when it prefers it,
// while the UI stays clean. Matching is conservative: a Monnify biller is only
// attached when its canonical DISCO key AND meter type both match a Kuda item,
// so an uncertain match never reroutes a payment.

type MeterType = 'prepaid' | 'postpaid';

function getMeterType(text: string | undefined | null): MeterType | null {
  if (!text) {
    return null;
  }
  const upper = text.toUpperCase();
  // Check postpaid first — "POSTPAID"/"-POST" must not be mistaken for prepaid.
  if (upper.includes('POSTPAID') || upper.endsWith('-POST')) {
    return 'postpaid';
  }
  if (upper.includes('PREPAID') || upper.endsWith('-PRE')) {
    return 'prepaid';
  }
  return null;
}

// Canonical DISCO key shared across providers (e.g. Kuda "EKEDC PREPAID" and
// Monnify "biller-ekedc-pre" both resolve to "EKEDC"). Falls back to distinct
// raw text when unknown, so non-matching billers never collide.
function getDiscoKey(text: string | undefined | null): string {
  return text ? resolveProviderRateKey(text, 'ELECTRICITY') : '';
}

function getMonnifyProductCode(biller: NormalizedBiller): string | undefined {
  return biller.billItems?.[0]?.productCode ?? biller.billerCode;
}

export interface DedupeElectricityResult {
  billers: NormalizedBiller[];
  /** Monnify billerCodes that were folded into a Kuda card (drop from display). */
  matchedMonnifyBillerCodes: Set<string>;
}

export function dedupeElectricityBillers(
  kudaBillers: NormalizedBiller[],
  monnifyBillers: NormalizedBiller[]
): DedupeElectricityResult {
  // Index Monnify billers by `${disco}:${meterType}`.
  const monnifyByKey = new Map<
    string,
    { billerCode: string; productCode: string }
  >();
  for (const monnify of monnifyBillers) {
    const source = monnify.billerCode ?? monnify.billerName ?? monnify.billerId;
    const meterType = getMeterType(source);
    const billerCode = monnify.billerCode;
    const productCode = getMonnifyProductCode(monnify);
    if (!(meterType && billerCode && productCode)) {
      continue;
    }
    monnifyByKey.set(`${getDiscoKey(source)}:${meterType}`, {
      billerCode,
      productCode,
    });
  }

  const matchedMonnifyBillerCodes = new Set<string>();

  const billers = kudaBillers.map((kuda) => {
    if (!kuda.billItems?.length) {
      return kuda;
    }
    const billItems = kuda.billItems.map((item) => {
      const source = item.itemName ?? item.itemCode;
      const meterType = getMeterType(source);
      if (!meterType) {
        return item;
      }
      const monnify = monnifyByKey.get(`${getDiscoKey(source)}:${meterType}`);
      if (!monnify) {
        return item;
      }
      matchedMonnifyBillerCodes.add(monnify.billerCode);
      return {
        ...item,
        monnifyBillerCode: monnify.billerCode,
        monnifyProductCode: monnify.productCode,
      };
    });
    return { ...kuda, billItems };
  });

  return { billers, matchedMonnifyBillerCodes };
}
