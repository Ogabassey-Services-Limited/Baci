import { describe, expect, it } from 'vitest';
import {
  buildWebVitalEndpointPayload,
  extractAttribution,
} from './web-vitals-reporter';

const base = { value: 1, id: 'v1', rating: 'poor', navigationType: 'navigate' };

describe('extractAttribution', () => {
  it('maps LCP attribution to the element + load sub-parts', () => {
    expect(
      extractAttribution({
        ...base,
        name: 'LCP',
        attribution: {
          element: 'img.hero',
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

  it('maps CLS attribution to the largest-shift target + value', () => {
    expect(
      extractAttribution({
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
      extractAttribution({
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
    expect(extractAttribution({ ...base, name: 'FCP' })).toEqual({});
  });

  it('ignores non-string/number attribution fields (e.g. nested objects)', () => {
    expect(
      extractAttribution({
        ...base,
        name: 'LCP',
        attribution: { element: 'img', target: { nested: true } },
      })
    ).toEqual({ debugTarget: 'img' });
  });
});

describe('buildWebVitalEndpointPayload', () => {
  it('keeps custom endpoint payloads compatible with the legacy schema', () => {
    const payload = buildWebVitalEndpointPayload({
      ...base,
      name: 'LCP',
      attribution: {
        element: 'img.hero',
        resourceLoadDuration: 1800,
      },
    });

    expect(payload).toMatchObject({
      name: 'LCP',
      value: 1,
      rating: 'poor',
      id: 'v1',
      navigationType: 'navigate',
    });
    expect(payload).not.toHaveProperty('attribution');
    expect(typeof payload.timestamp).toBe('number');
  });
});
