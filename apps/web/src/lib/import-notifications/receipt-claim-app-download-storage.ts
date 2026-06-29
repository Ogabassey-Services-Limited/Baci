const RECEIPT_CLAIM_APP_DOWNLOAD_TOKEN_KEY =
  'ogabassey:receipt-claim-app-download-token';

function getSessionStorage() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function rememberReceiptClaimAppDownloadToken(token: string) {
  const storage = getSessionStorage();
  if (!storage || !token) {
    return;
  }

  storage.setItem(RECEIPT_CLAIM_APP_DOWNLOAD_TOKEN_KEY, token);
}

export function readReceiptClaimAppDownloadToken() {
  return getSessionStorage()?.getItem(RECEIPT_CLAIM_APP_DOWNLOAD_TOKEN_KEY);
}
