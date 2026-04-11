export type CacStep = 'search' | 'upload' | 'result';
export type CacRegistrationPrefix = 'RC' | 'BN';

export type CacStatus = 'ACTIVE' | 'INACTIVE' | 'UNKNOWN';

export interface CacCompany {
  approvedName: string;
  rcNumber: string;
  status: CacStatus;
}

/**
 * Represents a user-selected CAC document before upload and verification.
 * `uri` is the local file location chosen on-device, `mimeType` is the
 * detected content type used for validation/upload, and `name` is the
 * user-visible filename shown in the KYC flow.
 */
export interface SelectedCacDocument {
  uri: string;
  mimeType: string;
  name: string;
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
