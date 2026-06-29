import { beforeEach, describe, expect, it } from 'vitest';
import {
  readReceiptClaimAppDownloadToken,
  rememberReceiptClaimAppDownloadToken,
} from './receipt-claim-app-download-storage';

describe('receipt claim app download storage', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('stores the latest claimed receipt token for app-download tracking', () => {
    rememberReceiptClaimAppDownloadToken('claim-token');

    expect(readReceiptClaimAppDownloadToken()).toBe('claim-token');
  });

  it('ignores empty tokens', () => {
    rememberReceiptClaimAppDownloadToken('');

    expect(readReceiptClaimAppDownloadToken()).toBeNull();
  });
});
