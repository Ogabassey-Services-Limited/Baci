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
  /**
   * Which Monnify productCodes were folded onto Kuda items, keyed by Monnify
   * billerCode. The route prunes these products from any retained Monnify card
   * (and drops cards that become empty), so a folded meter type never lingers as
   * a duplicate and an unmatched/unclassifiable product is never hidden.
   */
  matchedMonnifyProducts: Map<string, Set<string>>;
}

export function dedupeElectricityBillers(
  kudaBillers: NormalizedBiller[],
  monnifyBillers: NormalizedBiller[]
): DedupeElectricityResult {
  // Index Monnify products by `${disco}:${meterType}`.
  const monnifyByKey = new Map<
    string,
    { billerCode: string; productCode: string }
  >();

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
      // Prefer the descriptive name for the DISCO key — it always carries the
      // DISCO (e.g. "Eko Electricity Distribution") even when the billerCode is
      // opaque; fall back to the code/product label/id.
      const discoSource =
        monnify.billerName ??
        product?.itemName ??
        monnify.billerCode ??
        monnify.billerId;
      if (!(meterType && productCode)) {
        continue;
      }
      monnifyByKey.set(`${getDiscoKey(discoSource)}:${meterType}`, {
        billerCode,
        productCode,
      });
    }
  }

  const matchedMonnifyProducts = new Map<string, Set<string>>();
  const recordMatch = (billerCode: string, productCode: string) => {
    const set = matchedMonnifyProducts.get(billerCode) ?? new Set<string>();
    set.add(productCode);
    matchedMonnifyProducts.set(billerCode, set);
  };

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
      const monnify = monnifyByKey.get(`${disco}:${meterType}`);
      if (!monnify) {
        return item;
      }
      recordMatch(monnify.billerCode, monnify.productCode);
      return {
        ...item,
        monnifyBillerCode: monnify.billerCode,
        monnifyProductCode: monnify.productCode,
      };
    });
    return { ...kuda, billItems };
  });

  return { billers, matchedMonnifyProducts };
}
