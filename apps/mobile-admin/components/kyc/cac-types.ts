export type CacStep = 'search' | 'confirm' | 'upload' | 'result';

export type CacStatus = 'ACTIVE' | 'INACTIVE' | 'UNKNOWN';

export interface CacCompany {
  approvedName: string;
  rcNumber: string;
  status: CacStatus;
}

/**
 * Normalizes a raw status string from the CAC search API into a CacStatus
 * union. The upstream API returns arbitrary casing, so we collapse everything
 * we don't recognize into "UNKNOWN".
 */
export function normalizeCacStatus(raw: unknown): CacStatus {
  if (typeof raw !== 'string') return 'UNKNOWN';
  const upper = raw.trim().toUpperCase();
  if (upper === 'ACTIVE') return 'ACTIVE';
  if (upper === 'INACTIVE') return 'INACTIVE';
  return 'UNKNOWN';
}
