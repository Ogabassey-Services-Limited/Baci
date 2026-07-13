import 'server-only';

import type { PETROCK_DARK_IMEI_SERVICE_TIERS } from '@baci/shared/imei';

type PetrockDarkTierKey = (typeof PETROCK_DARK_IMEI_SERVICE_TIERS)[number];

interface PetrockInfoTierCandidate {
  costUsdBaseline: number;
  /** False until a captured replay covers the shared tier's checksIncluded. */
  fixtureVerified: false;
  /** Null means catalog sync must confirm the byte-exact field before binding. */
  orderFieldName: string | null;
  productId: string;
}

function candidate(
  productId: string,
  costUsdBaseline: number,
  orderFieldName: string | null = null
): PetrockInfoTierCandidate {
  return {
    costUsdBaseline,
    fixtureVerified: false,
    orderFieldName,
    productId,
  };
}

/**
 * Server-only curation queue. Entries do not participate in provider routing
 * until fixtureVerified is replaced by a reviewed active tier binding.
 */
export const PETROCK_INFO_TIER_CANDIDATES = {
  esimCompatibility: candidate('1941', 0.04),
  refurbishedStatus: candidate('1964', 0.04),
  replacementStatus: candidate('1966', 0.04),
  applePartNumber: candidate('1963', 0.04),
  attFinance: candidate('1957', 0.085),
  tmobileFinance: candidate('746', 0.037),
  verizonFinance: candidate('749', 0.04),
  knoxEnrollment: candidate('700', 0.06),
  samsungSoldBy: candidate('1990', 0.04),
  oneplusPremium: candidate('738', 0.04),
  transsionPremium: candidate('728', 0.04),
  // The trailing space was empirically confirmed and must remain byte-exact.
  macInfo: candidate('698', 0.3, 'Serial Number '),
  macPhotoReport: candidate('713', 0.675),
  applePremium: candidate('666', 0.75),
  applePremiumMax: candidate('1943', 1.85),
  tracfoneFinance: candidate('743', 0.04),
  xfinityFinance: candidate('2015', 0.04),
  japanDocomo: candidate('729', 0.09),
  japanSoftbank: candidate('731', 0.09),
  japanKddi: candidate('730', 0.09),
  japanRakuten: candidate('732', 0.09),
  japanNetwork: candidate('733', 0.09),
} as const satisfies Record<PetrockDarkTierKey, PetrockInfoTierCandidate>;
