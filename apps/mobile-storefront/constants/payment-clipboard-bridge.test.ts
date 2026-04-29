import { describe, expect, it, jest } from '@jest/globals';
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
      `type: '${escapeRegex(clipboardMessageType)}'[\\s\\S]*text: accountNumber`
    )
  );
  expect(script).toMatch(
    new RegExp(
      `type: '${escapeRegex(accountNumberMessageType)}'[\\s\\S]*text: accountNumber`
    )
  );
}

describe('PAYMENT_CLIPBOARD_BRIDGE', () => {
  // These implementation-detail assertions are deliberate: the injected script
  // is a contract between gateway web pages and the native WebView handler.
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

  it('forwards copied account numbers and ignores non-account clipboard text', async () => {
    const postedMessages: string[] = [];
    type CopyListener = (event: {
      clipboardData?: { getData: () => string };
    }) => void;
    let copyListener: CopyListener = () => undefined;
    const documentMock = {
      addEventListener: jest.fn((event: string, listener: unknown) => {
        if (event === 'copy') {
          copyListener = listener as CopyListener;
        }
      }),
      body: { innerText: '', textContent: '' },
      documentElement: { innerText: '', textContent: '' },
      execCommand: jest.fn(() => true),
      querySelector: jest.fn(() => null),
      readyState: 'complete',
    };
    const navigatorMock = {
      clipboard: {
        writeText: jest.fn<(_text: string) => Promise<void>>(() =>
          Promise.resolve()
        ),
      },
    };
    const mutationObservers: Array<{ trigger: (records?: unknown[]) => void }> =
      [];
    class MutationObserverMock {
      callback: (records: unknown[]) => void;
      observe = jest.fn();

      constructor(callback: (records: unknown[]) => void) {
        this.callback = callback;
        mutationObservers.push(this);
      }

      trigger(records: unknown[] = []) {
        this.callback(records);
      }
    }
    const windowMock = {
      MutationObserver: MutationObserverMock,
      ReactNativeWebView: {
        postMessage: jest.fn((message: string) => postedMessages.push(message)),
      },
      getSelection: jest.fn(() => ({ toString: () => '' })),
    };
    const runBridge = new Function(
      'window',
      'document',
      'navigator',
      'MutationObserver',
      'setTimeout',
      PAYMENT_CLIPBOARD_BRIDGE.script
    );

    runBridge(
      windowMock,
      documentMock,
      navigatorMock,
      MutationObserverMock,
      (callback: () => void) => {
        callback();
        return 1;
      }
    );

    documentMock.body.innerText = 'Account number: 2222222222';
    mutationObservers[0]?.trigger([{ type: 'childList' }]);
    await navigatorMock.clipboard.writeText('Reference REF 1234567890');
    await navigatorMock.clipboard.writeText('Account number: 1234567890');
    copyListener({
      clipboardData: {
        getData: () => 'OTP 123456',
      },
    });

    const clipboardMessages = postedMessages
      .map((message) => JSON.parse(message))
      .filter(
        (message) =>
          message.type === PAYMENT_CLIPBOARD_BRIDGE.clipboardMessageType
      );

    expect(clipboardMessages).toEqual([
      {
        text: '1234567890',
        type: PAYMENT_CLIPBOARD_BRIDGE.clipboardMessageType,
      },
    ]);
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
    expect(PAYMENT_CLIPBOARD_BRIDGE.script).toContain('var contextualPattern');
    expect(PAYMENT_CLIPBOARD_BRIDGE.script).toContain('var genericPattern');
    expect(PAYMENT_CLIPBOARD_BRIDGE.script).toContain(
      'function hasExcludedNumberContext'
    );
    expect(PAYMENT_CLIPBOARD_BRIDGE.script).toContain('routing|routingnumber');
    expect(PAYMENT_CLIPBOARD_BRIDGE.script).toContain('invoice|order|track');
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
