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

  it('maps INP LoAF fields including the flattened longest script', () => {
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
          totalScriptDuration: 180,
          totalStyleAndLayoutDuration: 35,
          totalPaintDuration: 12,
          totalUnattributedDuration: 8,
          longestScript: {
            subpart: 'processing-duration',
            intersectingDuration: 150,
            entry: {
              sourceURL: 'https://ogabassey.com/_next/static/chunks/rrweb.js',
              invoker: 'DOMWindow.onpointerdown',
            },
          },
        },
      })
    ).toEqual({
      debugTarget: 'button.add-to-cart',
      interactionType: 'pointer',
      inputDelay: 40,
      processingDuration: 120,
      presentationDelay: 60,
      loafScriptDuration: 180,
      loafStyleLayoutDuration: 35,
      loafPaintDuration: 12,
      loafUnattributedDuration: 8,
      loafLongestScriptSubpart: 'processing-duration',
      loafLongestScriptDuration: 150,
      loafLongestScriptSource:
        'https://ogabassey.com/_next/static/chunks/rrweb.js',
      loafLongestScriptInvoker: 'DOMWindow.onpointerdown',
    });
  });

  it('strips query/hash from the LoAF longest-script source URL', () => {
    const out = extractWebVitalAttribution({
      ...base,
      name: 'INP',
      attribution: {
        interactionTarget: 'button.buy',
        longestScript: {
          subpart: 'processing-duration',
          intersectingDuration: 90,
          entry: {
            sourceURL: 'https://cdn.example.com/pixel.js?token=secret#frag',
            invoker: 'DOMWindow.onclick',
          },
        },
      },
    });

    expect(out.loafLongestScriptSource).toBe(
      'https://cdn.example.com/pixel.js'
    );
    expect(out.loafLongestScriptInvoker).toBe('DOMWindow.onclick');
  });

  it('redacts URL content in LoAF invokers without mangling element-id invokers', () => {
    const invokerOut = (invoker: string) =>
      extractWebVitalAttribution({
        ...base,
        name: 'INP',
        attribution: { longestScript: { entry: { invoker } } },
      }).loafLongestScriptInvoker;

    // Classic/module-script entries return the script URL as `invoker`
    // (LoAF spec) — the query can carry signed tokens and must be dropped.
    expect(invokerOut('https://cdn.example.com/tag.js?sig=secret#f')).toBe(
      'https://cdn.example.com/tag.js'
    );
    // Event-listener invokers can embed the element source URL.
    expect(
      invokerOut('IMG[src=https://cdn.example.com/a.png?tok=x].onload')
    ).toBe('IMG[src=https://cdn.example.com/a.png].onload');
    // Element-id invokers use # for the id, NOT a URL hash — must survive.
    expect(invokerOut('BUTTON#checkout.onclick')).toBe(
      'BUTTON#checkout.onclick'
    );
    // Plain invoker names pass through unchanged.
    expect(invokerOut('DOMWindow.onpointerdown')).toBe(
      'DOMWindow.onpointerdown'
    );
  });

  it('omits LoAF fields when the browser provides none (non-Chromium)', () => {
    const out = extractWebVitalAttribution({
      ...base,
      name: 'INP',
      attribution: {
        interactionTarget: 'a.nav',
        interactionType: 'keyboard',
        inputDelay: 10,
        processingDuration: 50,
        presentationDelay: 20,
      },
    });

    expect(out.loafScriptDuration).toBeUndefined();
    expect(out.loafLongestScriptSource).toBeUndefined();
  });

  it('extracts longestScript subpart/duration without entry-level source or invoker', () => {
    const out = extractWebVitalAttribution({
      ...base,
      name: 'INP',
      attribution: {
        interactionTarget: 'a.nav',
        interactionType: 'keyboard',
        inputDelay: 10,
        processingDuration: 50,
        presentationDelay: 20,
        longestScript: {
          subpart: 'presentation-delay',
          intersectingDuration: 30,
        },
      },
    });

    expect(out.loafLongestScriptSubpart).toBe('presentation-delay');
    expect(out.loafLongestScriptDuration).toBe(30);
    expect(out.loafLongestScriptSource).toBeUndefined();
    expect(out.loafLongestScriptInvoker).toBeUndefined();
  });

  it('returns an empty object when attribution is absent', () => {
    expect(extractWebVitalAttribution({ ...base, name: 'FCP' })).toEqual({});
  });

  it('returns an empty object when attribution is an array', () => {
    expect(
      extractWebVitalAttribution({
        ...base,
        name: 'LCP',
        attribution: ['img.hero'],
      })
    ).toEqual({});
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
