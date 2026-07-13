/**
 * v1 subdivision vocabulary for merchant shipping zones, keyed by ISO 3166-1
 * country. Codes are ISO 3166-2; countries not listed here are country-level
 * only (merchants pick the whole country, no subdivisions).
 *
 * `resolveSubdivisionCode` is the CRITICAL bridge: checkout stores a free-text
 * state NAME ("Lagos", "FCT - Abuja"), while zones store CODES ("NG-LA",
 * "NG-FC"). The `aliases` cover the name variants the checkout/address flows
 * actually emit — cross-checked against
 * `apps/web/src/app/api/shipping/locations/fallback-locations.ts` and
 * `packages/shared/src/storefront/delivery-method-eligibility.ts`.
 */

export interface Subdivision {
  /** ISO 3166-2 code, e.g. `NG-LA`. */
  code: string;
  /** Canonical display name. */
  name: string;
  /** Alternate names/spellings the checkout state field may contain. */
  aliases?: string[];
}

const NIGERIA_SUBDIVISIONS: readonly Subdivision[] = [
  { code: 'NG-AB', name: 'Abia' },
  { code: 'NG-AD', name: 'Adamawa' },
  { code: 'NG-AK', name: 'Akwa Ibom' },
  { code: 'NG-AN', name: 'Anambra' },
  { code: 'NG-BA', name: 'Bauchi' },
  { code: 'NG-BY', name: 'Bayelsa' },
  { code: 'NG-BE', name: 'Benue' },
  { code: 'NG-BO', name: 'Borno' },
  { code: 'NG-CR', name: 'Cross River' },
  { code: 'NG-DE', name: 'Delta' },
  { code: 'NG-EB', name: 'Ebonyi' },
  { code: 'NG-ED', name: 'Edo' },
  { code: 'NG-EK', name: 'Ekiti' },
  { code: 'NG-EN', name: 'Enugu' },
  {
    code: 'NG-FC',
    name: 'Abuja (FCT)',
    aliases: [
      'FCT',
      'FCT - Abuja',
      'FCT Abuja',
      'Abuja',
      'Federal Capital Territory',
      'Abuja Federal Capital Territory',
    ],
  },
  { code: 'NG-GO', name: 'Gombe' },
  { code: 'NG-IM', name: 'Imo' },
  { code: 'NG-JI', name: 'Jigawa' },
  { code: 'NG-KD', name: 'Kaduna' },
  { code: 'NG-KN', name: 'Kano' },
  { code: 'NG-KT', name: 'Katsina' },
  { code: 'NG-KE', name: 'Kebbi' },
  { code: 'NG-KO', name: 'Kogi' },
  { code: 'NG-KW', name: 'Kwara' },
  { code: 'NG-LA', name: 'Lagos' },
  { code: 'NG-NA', name: 'Nasarawa', aliases: ['Nassarawa'] },
  { code: 'NG-NI', name: 'Niger' },
  { code: 'NG-OG', name: 'Ogun' },
  { code: 'NG-ON', name: 'Ondo' },
  { code: 'NG-OS', name: 'Osun' },
  { code: 'NG-OY', name: 'Oyo' },
  { code: 'NG-PL', name: 'Plateau' },
  { code: 'NG-RI', name: 'Rivers' },
  { code: 'NG-SO', name: 'Sokoto' },
  { code: 'NG-TA', name: 'Taraba' },
  { code: 'NG-YO', name: 'Yobe' },
  { code: 'NG-ZA', name: 'Zamfara' },
];

const INDIA_SUBDIVISIONS: readonly Subdivision[] = [
  { code: 'IN-AP', name: 'Andhra Pradesh' },
  { code: 'IN-AR', name: 'Arunachal Pradesh' },
  { code: 'IN-AS', name: 'Assam' },
  { code: 'IN-BR', name: 'Bihar' },
  { code: 'IN-CT', name: 'Chhattisgarh' },
  { code: 'IN-GA', name: 'Goa' },
  { code: 'IN-GJ', name: 'Gujarat' },
  { code: 'IN-HR', name: 'Haryana' },
  { code: 'IN-HP', name: 'Himachal Pradesh' },
  { code: 'IN-JH', name: 'Jharkhand' },
  { code: 'IN-KA', name: 'Karnataka' },
  { code: 'IN-KL', name: 'Kerala' },
  { code: 'IN-MP', name: 'Madhya Pradesh' },
  { code: 'IN-MH', name: 'Maharashtra' },
  { code: 'IN-MN', name: 'Manipur' },
  { code: 'IN-ML', name: 'Meghalaya' },
  { code: 'IN-MZ', name: 'Mizoram' },
  { code: 'IN-NL', name: 'Nagaland' },
  { code: 'IN-OD', name: 'Odisha', aliases: ['Orissa'] },
  { code: 'IN-PB', name: 'Punjab' },
  { code: 'IN-RJ', name: 'Rajasthan' },
  { code: 'IN-SK', name: 'Sikkim' },
  { code: 'IN-TN', name: 'Tamil Nadu' },
  { code: 'IN-TG', name: 'Telangana' },
  { code: 'IN-TR', name: 'Tripura' },
  { code: 'IN-UP', name: 'Uttar Pradesh' },
  { code: 'IN-UT', name: 'Uttarakhand', aliases: ['Uttaranchal'] },
  { code: 'IN-WB', name: 'West Bengal' },
  {
    code: 'IN-AN',
    name: 'Andaman and Nicobar Islands',
    aliases: ['Andaman & Nicobar Islands'],
  },
  { code: 'IN-CH', name: 'Chandigarh' },
  {
    code: 'IN-DH',
    name: 'Dadra and Nagar Haveli and Daman and Diu',
    aliases: ['Dadra and Nagar Haveli', 'Daman and Diu'],
  },
  {
    code: 'IN-DL',
    name: 'Delhi',
    aliases: [
      'NCT of Delhi',
      'National Capital Territory of Delhi',
      'New Delhi',
    ],
  },
  { code: 'IN-JK', name: 'Jammu and Kashmir' },
  { code: 'IN-LA', name: 'Ladakh' },
  { code: 'IN-LD', name: 'Lakshadweep' },
  { code: 'IN-PY', name: 'Puducherry', aliases: ['Pondicherry'] },
];

const UAE_SUBDIVISIONS: readonly Subdivision[] = [
  { code: 'AE-AZ', name: 'Abu Dhabi', aliases: ['Abu Zaby', 'Abudhabi'] },
  { code: 'AE-AJ', name: 'Ajman' },
  { code: 'AE-DU', name: 'Dubai', aliases: ['Dubayy'] },
  { code: 'AE-FU', name: 'Fujairah', aliases: ['Al Fujairah', 'Al Fujayrah'] },
  {
    code: 'AE-RK',
    name: 'Ras Al Khaimah',
    aliases: ['Ras al-Khaimah', "Ra's al Khaymah"],
  },
  { code: 'AE-SH', name: 'Sharjah', aliases: ['Ash Shariqah'] },
  {
    code: 'AE-UQ',
    name: 'Umm Al Quwain',
    aliases: ['Umm al-Quwain', 'Umm al Qaywayn'],
  },
];

const SUBDIVISIONS_BY_COUNTRY: Record<string, readonly Subdivision[]> = {
  NG: NIGERIA_SUBDIVISIONS,
  IN: INDIA_SUBDIVISIONS,
  AE: UAE_SUBDIVISIONS,
};

/**
 * Generic administrative-division suffix words shoppers append to a bare state
 * name ("Lagos State", "Punjab Province", "Ashanti Region"). The zone
 * vocabulary keys on the bare name ("Lagos" -> `NG-LA`), so a free-form/saved
 * address of "Lagos State" would otherwise miss and lose to the
 * country/rest-of-world fallback. Checkout's own manual address parser
 * (`statesMatch` -> `normalizeStateToken` in
 * `components/storefront/ogabassey/pages/checkout/utils.ts`) already strips a
 * trailing ` state`; this mirrors that (and extends it to province/region) so
 * the server-side `resolveSubdivisionCode` matches the same inputs. No NG/IN/AE
 * subdivision name or alias ends in one of these words, so stripping them from
 * both lookup keys and query input never collides distinct subdivisions.
 */
const GENERIC_SUBDIVISION_SUFFIX = /\s+(?:state|province|region)$/;

/**
 * lowercase, collapse any non-alphanumeric run to a single space, trim, then
 * drop a trailing generic administrative-division suffix word. Applied to both
 * lookup keys and query input so the two normalize identically.
 */
function normalizeName(value: string): string {
  const collapsed = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  return collapsed.replace(GENERIC_SUBDIVISION_SUFFIX, '').trim();
}

// Lazily-built name/alias/code -> code lookup, one per country.
const lookupCache = new Map<string, Map<string, string>>();

function getLookup(countryCode: string): Map<string, string> {
  const country = countryCode.trim().toUpperCase();
  const cached = lookupCache.get(country);
  if (cached) {
    return cached;
  }

  const lookup = new Map<string, string>();
  for (const subdivision of SUBDIVISIONS_BY_COUNTRY[country] ?? []) {
    lookup.set(normalizeName(subdivision.name), subdivision.code);
    lookup.set(normalizeName(subdivision.code), subdivision.code);
    for (const alias of subdivision.aliases ?? []) {
      lookup.set(normalizeName(alias), subdivision.code);
    }
  }
  lookupCache.set(country, lookup);
  return lookup;
}

/** Subdivisions for a country (empty array when the country is country-level only). */
export function getSubdivisions(countryCode: string): readonly Subdivision[] {
  return SUBDIVISIONS_BY_COUNTRY[countryCode.trim().toUpperCase()] ?? [];
}

/**
 * Resolve a free-text state name (or an already-ISO code) to its ISO 3166-2
 * code for the given country. Case/whitespace/punctuation-insensitive. Returns
 * `null` when the country is unknown or the name doesn't match.
 */
export function resolveSubdivisionCode(
  countryCode: string,
  stateName: string | null | undefined
): string | null {
  if (!stateName) {
    return null;
  }
  const normalized = normalizeName(stateName);
  if (normalized === '') {
    return null;
  }
  return getLookup(countryCode).get(normalized) ?? null;
}
