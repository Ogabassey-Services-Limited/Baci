interface GenerateDvaResponse {
  virtualAccount?: {
    account_name?: string | null;
    account_number?: string | null;
    bank?: string | null;
    bank_name?: string | null;
  } | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseGenerateDvaResponse(
  payload: unknown
): GenerateDvaResponse | null {
  if (!isRecord(payload)) {
    return null;
  }

  if (
    !('virtualAccount' in payload) ||
    (payload.virtualAccount !== null && !isRecord(payload.virtualAccount))
  ) {
    return null;
  }

  return payload as GenerateDvaResponse;
}
