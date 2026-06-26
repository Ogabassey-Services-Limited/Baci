// Branded Ogabassey utility-receipt styles. Kept in its own module so the
// receipt builder stays under the module-size budget. Used for both the in-app
// WebView preview and the generated PDF (single source of truth).
export const UTILITY_RECEIPT_CSS = `
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 24px 16px;
    background: #f3f4f6;
    color: #111827;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    -webkit-font-smoothing: antialiased;
    /* Centre the receipt vertically so the shared PDF/preview isn't top-stuck. */
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
  }
  .sheet {
    width: 100%;
    max-width: 460px;
    margin: 0 auto;
    background: #ffffff;
    border-radius: 20px;
    overflow: hidden;
    box-shadow: 0 10px 30px rgba(17, 24, 39, 0.08);
  }
  /* Branded angular accent echoing the Ogabassey wordmark banner. */
  .brandbar {
    display: flex;
    align-items: stretch;
    height: 8px;
    width: 100%;
  }
  .brandbar .bar-black {
    flex: 0 0 44%;
    background: #111827;
    clip-path: polygon(0 0, 100% 0, 86% 100%, 0 100%);
  }
  .brandbar .bar-gap { flex: 1 1 auto; background: #ffffff; }
  .brandbar .bar-red {
    flex: 0 0 44%;
    background: #DC2626;
    clip-path: polygon(14% 0, 100% 0, 100% 100%, 0 100%);
  }
  .head {
    background: #ffffff;
    color: #111827;
    padding: 22px 24px 20px;
    text-align: center;
    border-bottom: 1px solid #f3f4f6;
  }
  .logo {
    height: 30px;
    width: auto;
    max-width: 70%;
    object-fit: contain;
  }
  .head .doc { margin-top: 10px; font-size: 13px; color: #6b7280; letter-spacing: 0.3px; }
  .status {
    display: inline-block;
    margin-top: 12px;
    padding: 6px 14px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 700;
    background: #f3f4f6;
  }
  .hero { padding: 22px 24px 6px; text-align: center; }
  .hero .label { color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.6px; }
  .hero .amount { font-size: 34px; font-weight: 800; margin-top: 2px; }
  .body { padding: 8px 24px 4px; }
  .row {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    padding: 13px 0;
    border-top: 1px solid #f3f4f6;
  }
  .row span { color: #6b7280; font-size: 13px; }
  .row strong { font-size: 13px; font-weight: 700; max-width: 60%; text-align: right; word-break: break-word; }
  .token {
    margin: 16px 24px 4px;
    padding: 14px 16px;
    border: 1px dashed #DC2626;
    border-radius: 14px;
    background: #FEF2F2;
    text-align: center;
  }
  .token .label { color: #991B1B; font-size: 11px; text-transform: uppercase; letter-spacing: 0.6px; }
  .token .value { font-family: "SF Mono", Menlo, monospace; font-size: 20px; font-weight: 800; letter-spacing: 1px; margin-top: 4px; word-break: break-all; }
  .token .note { color: #991B1B; font-size: 11px; margin-top: 6px; }
  .cashback {
    margin: 14px 24px 4px;
    padding: 12px 16px;
    border-radius: 12px;
    background: #ECFDF5;
    color: #047857;
    font-size: 13px;
    font-weight: 700;
    display: flex;
    justify-content: space-between;
  }
  .foot {
    padding: 18px 24px 26px;
    text-align: center;
    color: #9ca3af;
    font-size: 11px;
    line-height: 1.5;
  }
  .foot .thanks { color: #6b7280; font-weight: 600; font-size: 12px; margin-bottom: 4px; }
`;
