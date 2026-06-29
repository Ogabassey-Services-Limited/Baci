const RECEIPT_CLAIMED_PARAM = 'receiptClaimed';
const RECEIPT_CLAIM_BASE_ORIGIN = 'https://receipt-claim.local';

function isAbsoluteUrl(path: string) {
  return /^[a-z][a-z\d+\-.]*:/i.test(path.trim());
}

export function withReceiptClaimedSearchParam(path: string) {
  try {
    const url = new URL(path, RECEIPT_CLAIM_BASE_ORIGIN);
    url.searchParams.set(RECEIPT_CLAIMED_PARAM, '1');
    if (isAbsoluteUrl(path)) {
      return url.toString();
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return path;
  }
}
