import { describe, expect, it } from '@jest/globals';
import { PAYMENT_CLIPBOARD_BRIDGE } from '@/constants/payment-clipboard-bridge';

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function expectBridgeMessageTypesToBeReferenced({
  accountNumberMessageType,
  clipboardMessageType,
  script,
}: {
  accountNumberMessageType: string;
  clipboardMessageType: string;
  script: string;
}) {
  if (!(accountNumberMessageType && clipboardMessageType)) {
    throw new Error('Payment clipboard bridge message types are required');
  }

  expect(script).toMatch(
    new RegExp(
      `type: '${escapeRegex(clipboardMessageType)}'[\\s\\S]*text: normalized`
    )
  );
  expect(script).toMatch(
    new RegExp(
      `type: '${escapeRegex(accountNumberMessageType)}'[\\s\\S]*text: accountNumber`
    )
  );
}

describe('PAYMENT_CLIPBOARD_BRIDGE', () => {
  it('posts the message types consumed by the native payment screen', () => {
    expect(PAYMENT_CLIPBOARD_BRIDGE.clipboardMessageType).toBeTruthy();
    expect(PAYMENT_CLIPBOARD_BRIDGE.accountNumberMessageType).toBeTruthy();
    expectBridgeMessageTypesToBeReferenced(PAYMENT_CLIPBOARD_BRIDGE);
  });

  it('rejects missing native bridge message types in the contract check', () => {
    expect(() =>
      expectBridgeMessageTypesToBeReferenced({
        ...PAYMENT_CLIPBOARD_BRIDGE,
        clipboardMessageType: '',
      })
    ).toThrow('Payment clipboard bridge message types are required');
    expect(() =>
      expectBridgeMessageTypesToBeReferenced({
        ...PAYMENT_CLIPBOARD_BRIDGE,
        accountNumberMessageType: '',
      })
    ).toThrow('Payment clipboard bridge message types are required');
  });

  it('is syntactically valid executable JavaScript', () => {
    expect(() => {
      new Function(PAYMENT_CLIPBOARD_BRIDGE.script);
    }).not.toThrow();
  });

  it('uses debounced account-number scanning for observers and retry timers', () => {
    expect(PAYMENT_CLIPBOARD_BRIDGE.script).toContain(
      'function scheduleAccountNumberScan()'
    );
    expect(PAYMENT_CLIPBOARD_BRIDGE.script).toContain(
      'new MutationObserver(scheduleAccountNumberScan)'
    );
    expect(PAYMENT_CLIPBOARD_BRIDGE.script).toContain(
      'setTimeout(scheduleAccountNumberScan, 500)'
    );
    expect(PAYMENT_CLIPBOARD_BRIDGE.script).toContain(
      'setTimeout(scheduleAccountNumberScan, 1500)'
    );
  });

  it('prefers contextual account-number detection before generic numbers', () => {
    expect(PAYMENT_CLIPBOARD_BRIDGE.script).toContain(
      'var contextualPattern'
    );
    expect(PAYMENT_CLIPBOARD_BRIDGE.script).toContain(
      'var genericPattern'
    );
    expect(PAYMENT_CLIPBOARD_BRIDGE.script).toContain(
      'function hasExcludedNumberContext'
    );
    expect(PAYMENT_CLIPBOARD_BRIDGE.script).toContain(
      'phone|tel|telephone|mobile|ref|reference'
    );
  });

  it('uses bounded account-number retry scanning and standalone copy matching', () => {
    // Native should not keep polling forever, and "copy" detection must not
    // match unrelated labels such as "copyright" or "photocopy".
    expect(PAYMENT_CLIPBOARD_BRIDGE.script).toContain('scanRetryCount >= 5');
    expect(PAYMENT_CLIPBOARD_BRIDGE.script).toContain('/\\bcopy\\b/i');
    expect(PAYMENT_CLIPBOARD_BRIDGE.script).not.toMatch(/\/copy\/i/);
  });

  it('does not append a standalone trailing true after the bridge IIFE', () => {
    expect(PAYMENT_CLIPBOARD_BRIDGE.script).not.toMatch(
      /\}\)\(\);\s*true;\s*$/
    );
  });
});
