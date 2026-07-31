type MatchStatus = 'FULL_MATCH' | 'PARTIAL_MATCH' | 'NO_MATCH';

type BvnMismatchField = 'name' | 'date_of_birth' | 'mobile_number';

interface NormalizedBvnMatchResult {
  verified: boolean;
  mismatchFields?: BvnMismatchField[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getMatchStatus(value: unknown): MatchStatus | null {
  return value === 'FULL_MATCH' ||
    value === 'PARTIAL_MATCH' ||
    value === 'NO_MATCH'
    ? value
    : null;
}

export default function normalizeBvnMatchResult(
  payload: unknown
): NormalizedBvnMatchResult | null {
  if (!isRecord(payload) || !isRecord(payload.responseBody)) return null;

  // Older Monnify responses omitted this envelope. Preserve that compatibility,
  // but never trust a body when the envelope explicitly reports a failure.
  const responseCode = payload.responseCode;
  const isSuccessfulResponseCode = responseCode === '0' || responseCode === 0;
  if (
    payload.requestSuccessful === false ||
    (Object.hasOwn(payload, 'responseCode') && !isSuccessfulResponseCode)
  ) {
    return null;
  }

  const body = payload.responseBody;
  if (typeof body.bvnInformationMatch === 'boolean') {
    return { verified: body.bvnInformationMatch };
  }

  const nameStatus = isRecord(body.name)
    ? getMatchStatus(body.name.matchStatus)
    : null;
  const dateOfBirthStatus = getMatchStatus(body.dateOfBirth);
  const mobileNumberStatus = getMatchStatus(body.mobileNo);

  if (nameStatus && dateOfBirthStatus && mobileNumberStatus) {
    const mismatchFields: BvnMismatchField[] = [];
    if (nameStatus !== 'FULL_MATCH') mismatchFields.push('name');
    if (dateOfBirthStatus !== 'FULL_MATCH') {
      mismatchFields.push('date_of_birth');
    }
    if (mobileNumberStatus !== 'FULL_MATCH') {
      mismatchFields.push('mobile_number');
    }

    return mismatchFields.length === 0
      ? { verified: true }
      : { verified: false, mismatchFields };
  }

  const legacyStatus = getMatchStatus(body.matchStatus);
  if (legacyStatus) {
    return { verified: legacyStatus === 'FULL_MATCH' };
  }

  return null;
}
