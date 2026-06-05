export const BNPL_VIEWPORT_JAVASCRIPT = `
  (function() {
    const viewportContent = 'width=device-width, initial-scale=1, viewport-fit=cover';

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

    applyViewportFix();
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', applyViewportFix, { once: true });
    }
    window.addEventListener('load', applyViewportFix, { once: true });
  })();
  true;
`;
