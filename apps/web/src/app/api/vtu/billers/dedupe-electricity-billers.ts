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
  // Index Monnify products by `${disco}:${meterType}`, and track which keys each
  // Monnify billerCode owns so we only drop a card once ALL its products folded.
  const monnifyByKey = new Map<
    string,
    { billerCode: string; productCode: string }
  >();
  const keysByBillerCode = new Map<string, Set<string>>();

  for (const monnify of monnifyBillers) {
    const billerCode = monnify.billerCode;
    if (!billerCode) {
      continue;
    }
    // A Monnify biller may carry multiple products (e.g. pre + post) — index each.
    const products = monnify.billItems?.length
      ? monnify.billItems
      : [undefined];
    for (const product of products) {
      // Meter type may live on the code (biller-ekedc-pre) OR only on the name /
      // product (generic code "IKEDC" + "Prepaid" name) — check all.
      const meterType =
        getMeterType(product?.itemName) ??
        getMeterType(product?.productCode) ??
        getMeterType(monnify.billerCode) ??
        getMeterType(monnify.billerName);
      const productCode =
        product?.productCode ?? getMonnifyProductCode(monnify);
      const discoSource =
        monnify.billerCode ?? monnify.billerName ?? monnify.billerId;
      if (!(meterType && productCode)) {
        continue;
      }
      const key = `${getDiscoKey(discoSource)}:${meterType}`;
      monnifyByKey.set(key, { billerCode, productCode });
      const owned = keysByBillerCode.get(billerCode) ?? new Set<string>();
      owned.add(key);
      keysByBillerCode.set(billerCode, owned);
    }
  }

  const matchedKeys = new Set<string>();

  const billers = kudaBillers.map((kuda) => {
    if (!kuda.billItems?.length) {
      return kuda;
    }
    const billItems = kuda.billItems.map((item) => {
      const meterType =
        getMeterType(item.itemName) ?? getMeterType(item.itemCode);
      if (!meterType) {
        return item;
      }
      // DISCO comes from the parent biller name (always carries the DISCO, e.g.
      // "EKEDC NG" / "APLE NG"); fall back to the item label if absent.
      const disco =
        getDiscoKey(kuda.billerName) ||
        getDiscoKey(item.itemName ?? item.itemCode);
      const key = `${disco}:${meterType}`;
      const monnify = monnifyByKey.get(key);
      if (!monnify) {
        return item;
      }
      matchedKeys.add(key);
      return {
        ...item,
        monnifyBillerCode: monnify.billerCode,
        monnifyProductCode: monnify.productCode,
      };
    });
    return { ...kuda, billItems };
  });

  // Only drop a Monnify card when every product it owns was folded into a Kuda
  // item — otherwise an unmatched meter type would silently disappear.
  const matchedMonnifyBillerCodes = new Set<string>();
  for (const [billerCode, owned] of keysByBillerCode) {
    if ([...owned].every((key) => matchedKeys.has(key))) {
      matchedMonnifyBillerCodes.add(billerCode);
    }
  }

  return { billers, matchedMonnifyBillerCodes };
}
