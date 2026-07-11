const PRERENDERING_CHANGE_EVENT = 'prerenderingchange';

/**
 * Reads `document.prerendering` (the Speculation Rules / Cloudflare Speed Brain
 * prerender flag) defensively. The property is not in the standard DOM lib
 * types and is absent in SSR and older browsers — a missing property is treated
 * as "not prerendering" so callers run immediately. Mirrors the identical guard
 * in `posthog/schedule-idle-boot.ts`.
 */
function isDocumentPrerendering(): boolean {
  return (
    typeof document !== 'undefined' &&
    (document as Document & { prerendering?: boolean }).prerendering === true
  );
}

/**
 * Runs `callback` once the page is actually presented to the user:
 * - immediately when the document is NOT being speculatively prerendered, or
 * - on the `prerenderingchange` activation event when it is.
 *
 * Speculatively prerendered pages execute all of their JavaScript in a hidden
 * tab (unlike Cloudflare Speed Brain, which only prefetches). Any analytics or
 * server-mutating side effect scheduled from an effect would therefore fire for
 * a page the user may never visit, corrupting pageview/attribution data. Gating
 * the side effect behind this helper defers it until activation; a prerender
 * that is discarded never fires `prerenderingchange`, so the callback never runs
 * and no junk data is minted.
 *
 * Returns a canceller that detaches the pending activation listener (a no-op
 * once the callback has already run or been cancelled). SSR-safe: with no
 * `document` it runs the callback synchronously and returns a no-op canceller,
 * matching the "not prerendering" path.
 */
export function runWhenPageActivated(callback: () => void): () => void {
  if (!isDocumentPrerendering()) {
    callback();
    return () => {
      // Already ran synchronously — nothing to cancel.
    };
  }

  let settled = false;

  function handleActivation(): void {
    // `prerenderingchange` can fire while still prerendering in some engines;
    // only run once the flag actually clears.
    if (settled || isDocumentPrerendering()) {
      return;
    }
    settled = true;
    document.removeEventListener(PRERENDERING_CHANGE_EVENT, handleActivation);
    callback();
  }

  document.addEventListener(PRERENDERING_CHANGE_EVENT, handleActivation);

  return () => {
    if (settled) {
      return;
    }
    settled = true;
    document.removeEventListener(PRERENDERING_CHANGE_EVENT, handleActivation);
  };
}
