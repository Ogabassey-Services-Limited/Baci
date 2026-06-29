const RECEIPT_CLAIMED_PARAM = 'receiptClaimed';

export function withReceiptClaimedSearchParam(path: string) {
  try {
    const url = new URL(path, 'https://receipt-claim.local');
    url.searchParams.set(RECEIPT_CLAIMED_PARAM, '1');
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return path;
  }
}
