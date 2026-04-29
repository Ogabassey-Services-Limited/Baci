const PAYMENT_ACCOUNT_NUMBER_MESSAGE_TYPE = 'payment_account_number_detected';
const PAYMENT_CLIPBOARD_MESSAGE_TYPE = 'payment_clipboard_copy';

export const PAYMENT_CLIPBOARD_BRIDGE = {
  accountNumberMessageType: PAYMENT_ACCOUNT_NUMBER_MESSAGE_TYPE,
  clipboardMessageType: PAYMENT_CLIPBOARD_MESSAGE_TYPE,
  script: `
(function () {
  if (window.__baciClipboardBridgeInstalled) {
    return true;
  }

  window.__baciClipboardBridgeInstalled = true;

  function sendMessage(payload) {
    if (
      window.ReactNativeWebView &&
      typeof window.ReactNativeWebView.postMessage === 'function'
    ) {
      window.ReactNativeWebView.postMessage(payload);
      return;
    }

    if (
      window.webkit &&
      window.webkit.messageHandlers &&
      window.webkit.messageHandlers.ReactNativeWebView &&
      typeof window.webkit.messageHandlers.ReactNativeWebView.postMessage === 'function'
    ) {
      window.webkit.messageHandlers.ReactNativeWebView.postMessage(payload);
    }
  }

  function postCopy(text) {
    if (typeof text !== 'string') {
      return;
    }

    var normalized = text.trim();
    if (!normalized) {
      return;
    }

    sendMessage(JSON.stringify({
      type: '${PAYMENT_CLIPBOARD_MESSAGE_TYPE}',
      text: normalized
    }));
  }

  var lastPostedAccountNumber = '';

  function findAccountNumber(text) {
    if (typeof text !== 'string') {
      return '';
    }

    var accountNumber = text.match(/(?:^|\\D)(\\d(?:[\\s-]?\\d){9})(?:\\D|$)/);
    return accountNumber ? accountNumber[1].replace(/\\D/g, '') : '';
  }

  function postAccountNumber(accountNumber) {
    if (!accountNumber || accountNumber === lastPostedAccountNumber) {
      return;
    }

    lastPostedAccountNumber = accountNumber;
    sendMessage(JSON.stringify({
      type: '${PAYMENT_ACCOUNT_NUMBER_MESSAGE_TYPE}',
      text: accountNumber
    }));
  }

  function scanForAccountNumber() {
    if (!document.body) {
      return;
    }

    postAccountNumber(findAccountNumber(
      document.body.innerText || document.body.textContent || ''
    ));
  }

  var accountNumberScanTimer = null;

  function scheduleAccountNumberScan() {
    if (accountNumberScanTimer) {
      return;
    }

    accountNumberScanTimer = setTimeout(function () {
      accountNumberScanTimer = null;
      scanForAccountNumber();
    }, 100);
  }

  function postNearestAccountNumber(target) {
    var node = target;
    var depth = 0;

    while (node && node !== document.body && depth < 6) {
      var text = node.innerText || node.textContent || '';
      var accountNumber = findAccountNumber(text);
      if (accountNumber) {
        postAccountNumber(accountNumber);
        postCopy(accountNumber);
        return;
      }
      node = node.parentElement;
      depth += 1;
    }

    var fallbackAccountNumber = findAccountNumber(
      document.body ? document.body.innerText || document.body.textContent || '' : ''
    );
    if (fallbackAccountNumber) {
      postAccountNumber(fallbackAccountNumber);
      postCopy(fallbackAccountNumber);
    }
  }

  var existingClipboard = navigator.clipboard || {};
  var originalWriteText =
    typeof existingClipboard.writeText === 'function'
      ? existingClipboard.writeText.bind(existingClipboard)
      : null;

  try {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: Object.assign({}, existingClipboard, {
        writeText: function (text) {
          postCopy(String(text));

          if (!originalWriteText) {
            return Promise.resolve();
          }

          var result = originalWriteText(text);
          if (result && typeof result.catch === 'function') {
            return result.catch(function (error) {
              console.error('Baci clipboard bridge writeText failed', error);
              return Promise.reject(error);
            });
          }

          return Promise.resolve();
        }
      })
    });
  } catch (error) {
    // Some gateway pages lock navigator.clipboard. The copy event fallback below
    // still lets native receive copied text.
  }

  var originalExecCommand =
    typeof document.execCommand === 'function'
      ? document.execCommand.bind(document)
      : null;

  if (originalExecCommand) {
    document.execCommand = function (command) {
      var result = originalExecCommand.apply(document, arguments);

      if (String(command).toLowerCase() === 'copy' && window.getSelection) {
        postCopy(window.getSelection().toString());
      }

      return result;
    };
  }

  document.addEventListener('copy', function (event) {
    var clipboardText = '';

    if (
      event.clipboardData &&
      typeof event.clipboardData.getData === 'function'
    ) {
      clipboardText = event.clipboardData.getData('text/plain');
    }

    if (!clipboardText && window.getSelection) {
      clipboardText = window.getSelection().toString();
    }

    postCopy(clipboardText);
  }, true);

  document.addEventListener('click', function (event) {
    var target = event.target;
    if (!target) {
      return;
    }

    var actionText = '';
    if (target.innerText || target.textContent) {
      actionText = target.innerText || target.textContent || '';
    }
    if (target.getAttribute) {
      actionText += ' ' + (target.getAttribute('aria-label') || '');
      actionText += ' ' + (target.getAttribute('title') || '');
    }

    if (/\\bcopy\\b/i.test(actionText)) {
      setTimeout(function () {
        postNearestAccountNumber(target);
      }, 0);
    }
  }, true);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scanForAccountNumber);
  } else {
    scanForAccountNumber();
  }

  if (window.MutationObserver && document.documentElement) {
    var observer = new MutationObserver(scheduleAccountNumberScan);
    observer.observe(document.documentElement, {
      characterData: true,
      childList: true,
      subtree: true
    });
  }

  setTimeout(scheduleAccountNumberScan, 500);
  setTimeout(scheduleAccountNumberScan, 1500);
  var scanRetryCount = 0;
  var scanRetryInterval = setInterval(function () {
    scanRetryCount += 1;
    scheduleAccountNumberScan();
    if (scanRetryCount >= 5) {
      clearInterval(scanRetryInterval);
    }
  }, 3000);

  return true;
})();
`,
} as const;
