import { describe, expect, it } from '@jest/globals';
import { PAYMENT_CLIPBOARD_BRIDGE } from './payment-clipboard-bridge';

describe('PAYMENT_CLIPBOARD_BRIDGE', () => {
  it('posts the message types consumed by the native payment screen', () => {
    expect(PAYMENT_CLIPBOARD_BRIDGE.script).toContain(
      PAYMENT_CLIPBOARD_BRIDGE.clipboardMessageType
    );
    expect(PAYMENT_CLIPBOARD_BRIDGE.script).toContain(
      PAYMENT_CLIPBOARD_BRIDGE.accountNumberMessageType
    );
  });
});
