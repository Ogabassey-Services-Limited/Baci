import { describe, expect, it } from '@jest/globals';
import { BNPL_VIEWPORT_JAVASCRIPT } from './bnpl-checkout-viewport';

describe('BNPL_VIEWPORT_JAVASCRIPT', () => {
  it('forces a device-width viewport before provider checkout content renders', () => {
    expect(BNPL_VIEWPORT_JAVASCRIPT).toContain(
      'width=device-width, initial-scale=1, viewport-fit=cover'
    );
    expect(BNPL_VIEWPORT_JAVASCRIPT).not.toContain('minimum-scale');
    expect(BNPL_VIEWPORT_JAVASCRIPT).not.toContain('maximum-scale');
    expect(BNPL_VIEWPORT_JAVASCRIPT).not.toContain('user-scalable');
    expect(BNPL_VIEWPORT_JAVASCRIPT).toContain(
      'document.querySelector(\'meta[name="viewport"]\')'
    );
  });

  it('prevents iOS WebKit input focus zoom without disabling pinch zoom', () => {
    expect(BNPL_VIEWPORT_JAVASCRIPT).toContain('isIOSWebKit');
    expect(BNPL_VIEWPORT_JAVASCRIPT).toContain(
      "target.style.fontSize = '16px'"
    );
    expect(BNPL_VIEWPORT_JAVASCRIPT).toContain(
      "target.style.webkitTextSizeAdjust = '100%'"
    );
    expect(BNPL_VIEWPORT_JAVASCRIPT).toContain(
      "document.addEventListener('touchstart'"
    );
    expect(BNPL_VIEWPORT_JAVASCRIPT).toContain(
      "document.addEventListener('focusin'"
    );
  });

  it('keeps the iOS input zoom fix scoped to form controls and dynamic content', () => {
    expect(BNPL_VIEWPORT_JAVASCRIPT).toContain('input:not([type="button"])');
    expect(BNPL_VIEWPORT_JAVASCRIPT).toContain('textarea');
    expect(BNPL_VIEWPORT_JAVASCRIPT).toContain('[contenteditable="true"]');
    expect(BNPL_VIEWPORT_JAVASCRIPT).toContain('new MutationObserver');
    expect(BNPL_VIEWPORT_JAVASCRIPT).toContain(
      "message: 'iOS input zoom adjustment failed'"
    );
  });

  it('does not inject global provider layout overrides', () => {
    expect(BNPL_VIEWPORT_JAVASCRIPT).not.toContain('iframe {');
    expect(BNPL_VIEWPORT_JAVASCRIPT).not.toContain('img, video, canvas');
    expect(BNPL_VIEWPORT_JAVASCRIPT).not.toContain('html, body');
    expect(BNPL_VIEWPORT_JAVASCRIPT).not.toContain('overflow-x: hidden');
    expect(BNPL_VIEWPORT_JAVASCRIPT).not.toContain('!important');
  });

  it('reports viewport adjustment failures to BNPL diagnostics', () => {
    expect(BNPL_VIEWPORT_JAVASCRIPT).toContain("type: 'bnpl_error_log'");
    expect(BNPL_VIEWPORT_JAVASCRIPT).toContain(
      "message: 'Viewport adjustment failed'"
    );
  });

  it('uses one-time load lifecycle hooks for repeated viewport fixes', () => {
    expect(BNPL_VIEWPORT_JAVASCRIPT).toContain(
      "document.addEventListener('DOMContentLoaded'"
    );
    expect(BNPL_VIEWPORT_JAVASCRIPT).toContain(
      "window.addEventListener('load'"
    );
    expect(BNPL_VIEWPORT_JAVASCRIPT).toContain('{ once: true }');
  });
});
