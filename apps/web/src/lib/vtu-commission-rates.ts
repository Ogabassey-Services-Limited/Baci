export type VtuCommissionCategory =
  | 'AIRTIME'
  | 'DATA'
  | 'ELECTRICITY'
  | 'CABLE'
  | 'BETTING'
  | 'EDUCATION'
  | 'SOLAR'
  | 'TRANSPORT'
  | 'INTERNET';

export interface VtuCommissionRate {
  rate: number;
  cap?: number;
}

type VtuProvider = 'kuda' | 'monnify';
type VtuCommissionRateMap = Record<string, VtuCommissionRate>;
type VtuProviderRoutingMap = Record<string, VtuProvider>;
type ReadonlyVtuCommissionRateMap = Readonly<
  Record<string, Readonly<VtuCommissionRate>>
>;
type ReadonlyVtuProviderRoutingMap = Readonly<Record<string, VtuProvider>>;

const VTU_COMMISSION_CATEGORY_ALIASES: Record<string, VtuCommissionCategory> = {
  AIRTIME: 'AIRTIME',
  BETTING: 'BETTING',
  CABLE: 'CABLE',
  CABLETV: 'CABLE',
  CABLE_TV: 'CABLE',
  DATA: 'DATA',
  ELECTRICITY: 'ELECTRICITY',
  POWER: 'ELECTRICITY',
  EDUCATION: 'EDUCATION',
  JAMB: 'EDUCATION',
  SOLAR: 'SOLAR',
  TRANSPORT: 'TRANSPORT',
  COWRY: 'TRANSPORT',
  INTERNET: 'INTERNET',
  ISP: 'INTERNET',
};

const KUDA_VTU_RATES: Record<string, VtuCommissionRate> = {
  MTN_AIRTIME: { rate: 0.03 },
  AIRTEL_AIRTIME: { rate: 0.03 },
  GLO_AIRTIME: { rate: 0.05 },
  '9MOBILE_AIRTIME': { rate: 0.045 },
  MTN_DATA: { rate: 0.03 },
  AIRTEL_DATA: { rate: 0.03 },
  GLO_DATA: { rate: 0.05 },
  '9MOBILE_DATA': { rate: 0.045 },
  BEDC_ELECTRICITY: { rate: 0.012 },
  IKEDC_ELECTRICITY: { rate: 0.008 },
  AEDC_ELECTRICITY: { rate: 0.012 },
  EKEDC_ELECTRICITY: { rate: 0.01, cap: 4000 },
  EEDC_ELECTRICITY: { rate: 0.012, cap: 2500 },
  IBEDC_ELECTRICITY: { rate: 0.01 },
  JEDC_ELECTRICITY: { rate: 0.01 },
  KAEDCO_ELECTRICITY: { rate: 0.012 },
  KEDCO_ELECTRICITY: { rate: 0.01 },
  PHEDC_ELECTRICITY: { rate: 0.012 },
  ABA_ELECTRICITY: { rate: 0.012, cap: 2500 },
  YEDC_ELECTRICITY: { rate: 0.01 },
  DSTV_CABLE: { rate: 0.016 },
  GOTV_CABLE: { rate: 0.016 },
  STARTIMES_CABLE: { rate: 0.012 },
  SHOWMAX_CABLE: { rate: 0.02 },
  SPORTYBET_BETTING: { rate: 0.005, cap: 800 },
  BET9JA_BETTING: { rate: 0.003 },
  NAIRABET_BETTING: { rate: 0.002 },
  '1XBET_BETTING': { rate: 0.002 },
  BETWAY_BETTING: { rate: 0.002 },
  BETPAWA_BETTING: { rate: 0.007 },
  BETKING_BETTING: { rate: 0.005, cap: 800 },
  MERRYBET_BETTING: { rate: 0.001 },
  BANGBET_BETTING: { rate: 0.004 },
  BETLAND_BETTING: { rate: 0.001 },
  NAIJABET_BETTING: { rate: 0.001 },
  MSPORT_BETTING: { rate: 0.005, cap: 800 },
  JAMB_UTME_EDUCATION: { rate: 0.024 },
  JAMB_DE_EDUCATION: { rate: 0.024 },
  LUMOS_SOLAR: { rate: 0.004, cap: 500 },
  PRIVIDA_SOLAR: { rate: 0.004, cap: 500 },
  SWITCH_SOLAR_SOLAR: { rate: 0.004, cap: 500 },
  GREENLIGHT_SOLAR: { rate: 0.004, cap: 500 },
  LASG_COWRY_TRANSPORT: { rate: 0.008 },
  SPECTRANET_INTERNET: { rate: 0.02 },
  SMILE_INTERNET: { rate: 0.02 },
  SWIFT_INTERNET: { rate: 0.006 },
  IPNX_INTERNET: { rate: 0.002 },
  HALLBET_BETTING: { rate: 0.0016 },
  FOOTBALL_COM_BETTING: { rate: 0.005, cap: 800 },
  SUREBET_BETTING: { rate: 0.008 },
  MLOTTO_BETTING: { rate: 0.002 },
  BETBABA_BETTING: { rate: 0.0016 },
  ACCESSBET_BETTING: { rate: 0.004, cap: 1000 },
};

const MONNIFY_VTU_RATES: Record<string, VtuCommissionRate> = {
  MTN_AIRTIME: { rate: 0.03 },
  AIRTEL_AIRTIME: { rate: 0.03 },
  GLO_AIRTIME: { rate: 0.04 },
  '9MOBILE_AIRTIME': { rate: 0.05 },
  MTN_DATA: { rate: 0.03 },
  AIRTEL_DATA: { rate: 0.03 },
  GLO_DATA: { rate: 0.04 },
  '9MOBILE_DATA': { rate: 0.05 },
  BEDC_ELECTRICITY: { rate: 0.018 },
  IKEDC_ELECTRICITY: { rate: 0.008 },
  AEDC_ELECTRICITY: { rate: 0.015 },
  EKEDC_ELECTRICITY: { rate: 0.01 },
  EEDC_ELECTRICITY: { rate: 0.018 },
  IBEDC_ELECTRICITY: { rate: 0.009 },
  JEDC_ELECTRICITY: { rate: 0.015 },
  KAEDCO_ELECTRICITY: { rate: 0.015 },
  KEDCO_ELECTRICITY: { rate: 0.013 },
  PHEDC_ELECTRICITY: { rate: 0.014 },
  ABA_ELECTRICITY: { rate: 0.015 },
  YEDC_ELECTRICITY: { rate: 0.011 },
  DSTV_CABLE: { rate: 0.015 },
  GOTV_CABLE: { rate: 0.015 },
  STARTIMES_CABLE: { rate: 0.015 },
  SPORTYBET_BETTING: { rate: 0.001 },
  BET9JA_BETTING: { rate: 0.001 },
  NAIRABET_BETTING: { rate: 0.001 },
  '1XBET_BETTING': { rate: 0.002 },
  BETWAY_BETTING: { rate: 0.005 },
  BETKING_BETTING: { rate: 0.005 },
  MERRYBET_BETTING: { rate: 0.001 },
  BANGBET_BETTING: { rate: 0.005 },
  BETLAND_BETTING: { rate: 0.001 },
  NAIJABET_BETTING: { rate: 0.001 },
  ILOT_BETTING: { rate: 0.007 },
  MSPORT_BETTING: { rate: 0.001 },
  BETPAWA_BETTING: { rate: 0.007 },
};

export function determineRoutingAndRates({
  kudaRates = KUDA_VTU_RATES,
  monnifyRates = MONNIFY_VTU_RATES,
}: {
  kudaRates?: VtuCommissionRateMap;
  monnifyRates?: VtuCommissionRateMap;
} = {}): {
  routing: ReadonlyVtuProviderRoutingMap;
  rates: ReadonlyVtuCommissionRateMap;
} {
  const routing: VtuProviderRoutingMap = {};
  const rates: VtuCommissionRateMap = {};

  const allKeys = new Set([
    ...Object.keys(kudaRates),
    ...Object.keys(monnifyRates),
  ]);

  for (const key of allKeys) {
    const kudaRate = kudaRates[key];
    const monnifyRate = monnifyRates[key];

    if (!kudaRate && monnifyRate) {
      routing[key] = 'monnify';
      rates[key] = { ...monnifyRate };
    } else if (kudaRate && !monnifyRate) {
      routing[key] = 'kuda';
      rates[key] = { ...kudaRate };
    } else if (kudaRate && monnifyRate && monnifyRate.rate > kudaRate.rate) {
      // Compare rates: higher rate wins. Ties (or higher) go to Monnify.
      routing[key] = 'monnify';
      rates[key] = { ...monnifyRate };
    } else if (kudaRate && monnifyRate && kudaRate.rate > monnifyRate.rate) {
      routing[key] = 'kuda';
      rates[key] = { ...kudaRate };
    } else {
      if (!kudaRate || !monnifyRate) {
        continue;
      }

      // Equal rate. Compare caps: uncapped is better than capped.
      const monnifyCapped = monnifyRate.cap !== undefined;
      const kudaCapped = kudaRate.cap !== undefined;

      if (monnifyCapped && !kudaCapped) {
        routing[key] = 'kuda';
        rates[key] = { ...kudaRate };
      } else if (!monnifyCapped && kudaCapped) {
        routing[key] = 'monnify';
        rates[key] = { ...monnifyRate };
      } else if (monnifyCapped && kudaCapped) {
        // Both capped. Compare caps: higher cap is better. If equal, Monnify wins.
        const monnifyCap = monnifyRate.cap ?? 0;
        const kudaCap = kudaRate.cap ?? 0;
        if (monnifyCap > kudaCap) {
          routing[key] = 'monnify';
          rates[key] = { ...monnifyRate };
        } else if (kudaCap > monnifyCap) {
          routing[key] = 'kuda';
          rates[key] = { ...kudaRate };
        } else {
          routing[key] = 'monnify';
          rates[key] = { ...monnifyRate };
        }
      } else {
        // Both uncapped: tie goes to Monnify.
        routing[key] = 'monnify';
        rates[key] = { ...monnifyRate };
      }
    }
  }

  rates.DEFAULT = { rate: 0.02 };

  for (const rate of Object.values(rates)) {
    Object.freeze(rate);
  }

  return { routing: Object.freeze(routing), rates: Object.freeze(rates) };
}

const computed = determineRoutingAndRates();

export const VTU_PROVIDER_ROUTING = computed.routing;
export const VTU_COMMISSION_RATES = computed.rates;

const VTU_COMMISSION_PROVIDER_ALIASES = {
  AIRTIME: [
    ['MTN', ['MTN', 'MTNNG']],
    ['AIRTEL', ['AIRTEL', 'AIRTELNG']],
    ['GLO', ['GLO', 'GLONG']],
    ['9MOBILE', ['9MOBILE', 'MOBILE9', 'ETISALAT']],
  ],
  DATA: [
    ['MTN', ['MTN', 'MTNNG']],
    ['AIRTEL', ['AIRTEL', 'AIRTELNG']],
    ['GLO', ['GLO', 'GLONG']],
    ['9MOBILE', ['9MOBILE', 'MOBILE9', 'ETISALAT']],
  ],
  ELECTRICITY: [
    ['BEDC', ['BEDC', 'BENIN']],
    ['IKEDC', ['IKEDC', 'IKED', 'IKEJA']],
    ['AEDC', ['AEDC', 'ABUJA']],
    ['EKEDC', ['EKEDC', 'EKED', 'EKO']],
    ['EEDC', ['EEDC', 'ENUGU']],
    ['IBEDC', ['IBEDC', 'IBED', 'IBADAN']],
    ['JEDC', ['JEDC', 'JOS']],
    ['KAEDCO', ['KAEDCO', 'KAEDC', 'KAED', 'KADUNA']],
    ['KEDCO', ['KEDCO', 'KEDC', 'KANO']],
    ['PHEDC', ['PHEDC', 'PHED', 'PORTHARCOURT']],
    ['ABA', ['ABA', 'APLE']],
    ['YEDC', ['YEDC', 'YOLA']],
  ],
  CABLE: [
    ['DSTV', ['DSTV', 'DSTVNG']],
    ['GOTV', ['GOTV', 'GOTVNG']],
    ['STARTIMES', ['STARTIMES', 'STARTIMESNG']],
    ['SHOWMAX', ['SHOWMAX']],
  ],
  BETTING: [
    ['SPORTYBET', ['SPORTYBET']],
    ['BET9JA', ['BET9JA']],
    ['NAIRABET', ['NAIRABET', 'NAIRABETNG']],
    ['1XBET', ['1XBET']],
    ['BETWAY', ['BETWAY']],
    ['BETKING', ['BETKING']],
    ['MERRYBET', ['MERRYBET']],
    ['BANGBET', ['BANGBET']],
    ['BETLAND', ['BETLAND']],
    ['NAIJABET', ['NAIJABET', 'NAIJA BET']],
    ['ILOT', ['ILOT']],
    ['MSPORT', ['MSPORT']],
    ['BETPAWA', ['BETPAWA']],
    ['HALLBET', ['HALLBET']],
    ['FOOTBALL_COM', ['FOOTBALL COM', 'FOOTBALL.COM', 'FOOTBALLCOM']],
    ['SUREBET', ['SUREBET']],
    ['MLOTTO', ['MLOTTO']],
    ['BETBABA', ['BETBABA']],
    ['ACCESSBET', ['ACCESSBET']],
  ],
  EDUCATION: [
    ['JAMB_UTME', ['JAMB UTME', 'UTME']],
    ['JAMB_DE', ['JAMB DE', 'DIRECT ENTRY']],
  ],
  SOLAR: [
    ['LUMOS', ['LUMOS']],
    ['PRIVIDA', ['PRIVIDA']],
    ['SWITCH_SOLAR', ['SWITCH SOLAR', 'SWITCH']],
    ['GREENLIGHT', ['GREENLIGHT', 'GREENLIGHT PLANET']],
  ],
  TRANSPORT: [['LASG_COWRY', ['LASG COWRY', 'COWRY']]],
  INTERNET: [
    ['SPECTRANET', ['SPECTRANET']],
    ['SMILE', ['SMILE']],
    ['SWIFT', ['SWIFT']],
    ['IPNX', ['IPNX']],
  ],
} satisfies Record<
  VtuCommissionCategory,
  ReadonlyArray<readonly [string, readonly string[]]>
>;

function normalizeLookupText(value: string) {
  return value
    .toUpperCase()
    .replace(/&/g, ' AND ')
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

function compactLookupText(value: string) {
  return normalizeLookupText(value).replace(/\s+/g, '');
}

export function normalizeVtuCommissionCategory(
  value: unknown
): VtuCommissionCategory {
  const compactCategory =
    typeof value === 'string' ? compactLookupText(value) : '';

  return VTU_COMMISSION_CATEGORY_ALIASES[compactCategory] ?? 'AIRTIME';
}

export function resolveProviderRateKey(
  provider: unknown,
  category: VtuCommissionCategory
) {
  const compactProvider =
    typeof provider === 'string' ? compactLookupText(provider) : '';
  const aliases = VTU_COMMISSION_PROVIDER_ALIASES[category];
  let bestPartialMatch: { aliasLength: number; providerKey: string } | null =
    null;

  for (const [providerKey, providerAliases] of aliases) {
    if (
      providerAliases.some(
        (alias) => compactProvider === compactLookupText(alias)
      )
    ) {
      return providerKey;
    }
  }

  for (const [providerKey, providerAliases] of aliases) {
    for (const alias of providerAliases) {
      const compactAlias = compactLookupText(alias);
      if (
        compactProvider.includes(compactAlias) &&
        compactAlias.length > (bestPartialMatch?.aliasLength ?? 0)
      ) {
        bestPartialMatch = {
          aliasLength: compactAlias.length,
          providerKey,
        };
      }
    }
  }

  return bestPartialMatch?.providerKey ?? compactProvider;
}

export function getVtuCommissionRate(
  provider: unknown,
  category: unknown = 'AIRTIME'
): VtuCommissionRate {
  const normalizedCategory = normalizeVtuCommissionCategory(category);
  const providerKey = resolveProviderRateKey(provider, normalizedCategory);

  const rate =
    VTU_COMMISSION_RATES[`${providerKey}_${normalizedCategory}`] ??
    VTU_COMMISSION_RATES[providerKey] ??
    VTU_COMMISSION_RATES.DEFAULT;

  return { ...rate };
}

export function getKudaVtuCommissionRate(
  provider: unknown,
  category: unknown = 'AIRTIME'
): VtuCommissionRate {
  const normalizedCategory = normalizeVtuCommissionCategory(category);
  const providerKey = resolveProviderRateKey(provider, normalizedCategory);
  const key = `${providerKey}_${normalizedCategory}`;

  const rate = KUDA_VTU_RATES[key] ??
    KUDA_VTU_RATES[providerKey] ?? { rate: 0.02 };

  return { ...rate };
}

function getMonnifyVtuCommissionRate(
  provider: unknown,
  category: unknown = 'AIRTIME'
): VtuCommissionRate {
  const normalizedCategory = normalizeVtuCommissionCategory(category);
  const providerKey = resolveProviderRateKey(provider, normalizedCategory);
  const key = `${providerKey}_${normalizedCategory}`;

  const rate = MONNIFY_VTU_RATES[key] ??
    MONNIFY_VTU_RATES[providerKey] ?? { rate: 0.02 };

  return { ...rate };
}

export function getProviderVtuCommissionRate(
  provider: unknown,
  category: unknown = 'AIRTIME',
  providerSource?: 'kuda' | 'monnify'
): VtuCommissionRate {
  if (providerSource === 'kuda') {
    return getKudaVtuCommissionRate(provider, category);
  }

  if (providerSource === 'monnify') {
    return getMonnifyVtuCommissionRate(provider, category);
  }

  return getVtuCommissionRate(provider, category);
}

export function resolveVtuProvider(
  provider: unknown,
  category: unknown = 'AIRTIME'
): 'kuda' | 'monnify' {
  const normalizedCategory = normalizeVtuCommissionCategory(category);
  const providerKey = resolveProviderRateKey(provider, normalizedCategory);
  const key = `${providerKey}_${normalizedCategory}`;

  return (
    VTU_PROVIDER_ROUTING[key] ?? VTU_PROVIDER_ROUTING[providerKey] ?? 'kuda'
  );
}
