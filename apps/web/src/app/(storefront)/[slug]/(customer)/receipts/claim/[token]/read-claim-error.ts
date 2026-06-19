interface ClaimPreview {
  claim: {
    claimed: boolean;
    customerName: string | null;
    devices: string[];
    merchantName: string;
  };
}

export function readClaimError(
  data: ClaimPreview | { error?: string },
  fallback: string
) {
  return 'error' in data && typeof data.error === 'string'
    ? data.error
    : fallback;
}
