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

  try {
    storage.setItem(RECEIPT_CLAIM_APP_DOWNLOAD_TOKEN_KEY, token);
  } catch {
    // Best-effort attribution storage; receipt claim navigation must not fail.
  }
}

export function readReceiptClaimAppDownloadToken() {
  const storage = getSessionStorage();
  if (!storage) {
    return null;
  }

  try {
    return storage.getItem(RECEIPT_CLAIM_APP_DOWNLOAD_TOKEN_KEY);
  } catch {
    return null;
  }
}
