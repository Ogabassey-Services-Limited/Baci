export type VtuCommissionCategory =
  | 'AIRTIME'
  | 'DATA'
  | 'ELECTRICITY'
  | 'CABLE'
  | 'BETTING';

export interface VtuCommissionRate {
  rate: number;
  cap?: number;
}

const VTU_COMMISSION_CATEGORY_ALIASES: Record<string, VtuCommissionCategory> = {
  AIRTIME: 'AIRTIME',
  BETTING: 'BETTING',
  CABLE: 'CABLE',
  CABLETV: 'CABLE',
  CABLE_TV: 'CABLE',
  DATA: 'DATA',
  ELECTRICITY: 'ELECTRICITY',
  POWER: 'ELECTRICITY',
};

const createCommissionRates = (
  rates: Record<string, VtuCommissionRate>
): Readonly<Record<string, Readonly<VtuCommissionRate>>> =>
  Object.freeze(
    Object.fromEntries(
      Object.entries(rates).map(([key, rate]) => [key, Object.freeze(rate)])
    ) as Record<string, Readonly<VtuCommissionRate>>
  );

export const VTU_COMMISSION_RATES = createCommissionRates({
  MTN_AIRTIME: { rate: 0.03 },
  AIRTEL_AIRTIME: { rate: 0.03 },
  GLO_AIRTIME: { rate: 0.05 },
  '9MOBILE_AIRTIME': { rate: 0.045 },
  MTN_DATA: { rate: 0.03 },
  AIRTEL_DATA: { rate: 0.03 },
  GLO_DATA: { rate: 0.05 },
  '9MOBILE_DATA': { rate: 0.045 },
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
  DEFAULT: { rate: 0.02 },
});

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
    ['ABA', ['ABA']],
    ['YEDC', ['YEDC', 'YOLA']],
  ],
  CABLE: [
    ['DSTV', ['DSTV', 'DSTVNG']],
    ['GOTV', ['GOTV', 'GOTVNG']],
    ['STARTIMES', ['STARTIMES', 'STARTIMESNG']],
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

function resolveProviderRateKey(
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
