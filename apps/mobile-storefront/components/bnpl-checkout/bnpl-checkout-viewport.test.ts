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
      "document.querySelector('meta[name=\"viewport\"]')"
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
      "document.addEventListener('DOMContentLoaded', applyViewportFix, { once: true })"
    );
    expect(BNPL_VIEWPORT_JAVASCRIPT).toContain(
      "window.addEventListener('load', applyViewportFix, { once: true })"
    );
  });
});
