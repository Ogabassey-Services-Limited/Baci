import { describe, expect, it } from 'vitest';
import { extractWebVitalAttribution } from './web-vital-attribution';

const base = { value: 1, id: 'v1', rating: 'poor', navigationType: 'navigate' };

describe('extractWebVitalAttribution', () => {
  it('maps web-vitals v5 LCP target attribution to the debug target', () => {
    expect(
      extractWebVitalAttribution({
        ...base,
        name: 'LCP',
        attribution: {
          target: 'img.hero',
          url: 'https://cdn.ogabassey.com/x.avif',
          timeToFirstByte: 600,
          resourceLoadDelay: 200,
          resourceLoadDuration: 1800,
          elementRenderDelay: 100,
        },
      })
    ).toEqual({
      debugTarget: 'img.hero',
      lcpUrl: 'https://cdn.ogabassey.com/x.avif',
      ttfb: 600,
      loadDelay: 200,
      loadDuration: 1800,
      renderDelay: 100,
    });
  });

  it('falls back to legacy LCP element attribution when target is absent', () => {
    expect(
      extractWebVitalAttribution({
        ...base,
        name: 'LCP',
        attribution: { element: 'img.legacy-hero' },
      })
    ).toEqual({ debugTarget: 'img.legacy-hero' });
  });

  it('maps CLS attribution to the largest-shift target + value', () => {
    expect(
      extractWebVitalAttribution({
        ...base,
        name: 'CLS',
        attribution: {
          largestShiftTarget: 'div.banner',
          largestShiftValue: 0.28,
          loadState: 'complete',
        },
      })
    ).toEqual({
      debugTarget: 'div.banner',
      shiftValue: 0.28,
      loadState: 'complete',
    });
  });

  it('maps INP attribution to the interaction target + timings', () => {
    expect(
      extractWebVitalAttribution({
        ...base,
        name: 'INP',
        attribution: {
          interactionTarget: 'button.add-to-cart',
          interactionType: 'pointer',
          inputDelay: 40,
          processingDuration: 120,
          presentationDelay: 60,
        },
      })
    ).toEqual({
      debugTarget: 'button.add-to-cart',
      interactionType: 'pointer',
      inputDelay: 40,
      processingDuration: 120,
      presentationDelay: 60,
    });
  });

  it('returns an empty object when attribution is absent', () => {
    expect(extractWebVitalAttribution({ ...base, name: 'FCP' })).toEqual({});
  });

  it('ignores non-string/number attribution fields', () => {
    expect(
      extractWebVitalAttribution({
        ...base,
        name: 'LCP',
        attribution: { target: { nested: true }, element: 'img' },
      })
    ).toEqual({ debugTarget: 'img' });
  });
});
