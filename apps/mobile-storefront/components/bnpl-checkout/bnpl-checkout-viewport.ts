export const BNPL_VIEWPORT_JAVASCRIPT = `
  (function() {
    const viewportContent = 'width=device-width, initial-scale=1, viewport-fit=cover';
    const formControlSelector = [
      'input:not([type="button"]):not([type="checkbox"]):not([type="color"]):not([type="file"]):not([type="hidden"]):not([type="image"]):not([type="radio"]):not([type="range"]):not([type="reset"]):not([type="submit"])',
      'select',
      'textarea',
      '[contenteditable="true"]',
      '[role="textbox"]'
    ].join(',');
    const isIOSWebKit = /iP(ad|hone|od)/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    const applyViewportFix = function() {
      try {
        const head = document.head || document.getElementsByTagName('head')[0] || document.documentElement;
        let viewport = document.querySelector('meta[name="viewport"]');
        if (!viewport) {
          viewport = document.createElement('meta');
          viewport.setAttribute('name', 'viewport');
          head.appendChild(viewport);
        }
        viewport.setAttribute('content', viewportContent);
      } catch (error) {
        try {
          window.ReactNativeWebView?.postMessage(JSON.stringify({
            type: 'bnpl_error_log',
            message: 'Viewport adjustment failed',
            source: window.location.href,
            error: error instanceof Error ? error.message : String(error)
          }));
        } catch (_diagnosticsError) {
          // Ignore diagnostics failures so checkout can keep running.
        }
      }
    };

    const normalizeControlFontSize = function(element) {
      if (!isIOSWebKit || !element || element.nodeType !== 1) {
        return;
      }

      const target = element.matches?.(formControlSelector)
        ? element
        : element.closest?.(formControlSelector);
      if (!target || target.dataset.baciBnplIosFontAdjusted === 'true') {
        return;
      }

      const fontSize = Number.parseFloat(window.getComputedStyle(target).fontSize);
      if (!Number.isFinite(fontSize) || fontSize >= 16) {
        return;
      }

      target.dataset.baciBnplIosFontAdjusted = 'true';
      target.style.fontSize = '16px';
      target.style.webkitTextSizeAdjust = '100%';
    };

    const applyIOSInputZoomFix = function(root) {
      if (!isIOSWebKit) {
        return;
      }

      try {
        const scope = root?.querySelectorAll ? root : document;
        scope.querySelectorAll(formControlSelector).forEach(normalizeControlFontSize);
      } catch (error) {
        try {
          window.ReactNativeWebView?.postMessage(JSON.stringify({
            type: 'bnpl_error_log',
            message: 'iOS input zoom adjustment failed',
            source: window.location.href,
            error: error instanceof Error ? error.message : String(error)
          }));
        } catch (_diagnosticsError) {
          // Ignore diagnostics failures so checkout can keep running.
        }
      }
    };

    applyViewportFix();
    applyIOSInputZoomFix(document);
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() {
        applyViewportFix();
        applyIOSInputZoomFix(document);
      }, { once: true });
    }
    window.addEventListener('load', function() {
      applyViewportFix();
      applyIOSInputZoomFix(document);
    }, { once: true });
    document.addEventListener('touchstart', function(event) {
      normalizeControlFontSize(event.target);
    }, true);
    document.addEventListener('focusin', function(event) {
      normalizeControlFontSize(event.target);
    }, true);

    if (isIOSWebKit && window.MutationObserver) {
      new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
          mutation.addedNodes.forEach(function(node) {
            if (node.nodeType === 1) {
              normalizeControlFontSize(node);
              applyIOSInputZoomFix(node);
            }
          });
        });
      }).observe(document.documentElement, { childList: true, subtree: true });
    }
  })();
  true;
`;
