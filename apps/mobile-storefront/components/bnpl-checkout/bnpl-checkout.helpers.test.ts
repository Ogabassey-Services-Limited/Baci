import { describe, expect, it } from '@jest/globals';
import {
  areBNPLCheckoutUrlsEquivalent,
  BNPL_INJECTED_JAVASCRIPT,
  buildBNPLCheckoutUrl,
  buildBNPLDocumentSource,
  getBNPLDebugUrlDetails,
  isBNPLCheckoutExitUrl,
  parseBNPLParams,
  resolveBNPLDocumentNavigation,
  sanitizeBNPLDocumentUrl,
} from './bnpl-checkout.helpers';

describe('bnpl-checkout helpers', () => {
  it('removes Next.js RSC query params from document URLs', () => {
    const sanitized = sanitizeBNPLDocumentUrl(
      'https://usebaci.com/ogabassey/checkout/bnpl?gateway=credit_direct&orderId=order-1&_rsc=abc123'
    );

    expect(sanitized).toBe(
      'https://usebaci.com/ogabassey/checkout/bnpl?gateway=credit_direct&orderId=order-1'
    );
  });

  it('builds stable WebView document sources with an HTML accept header', () => {
    expect(
      buildBNPLDocumentSource(
        'https://usebaci.com/ogabassey/checkout/bnpl?gateway=klump&_rsc=abc123'
      )
    ).toEqual({
      headers: {
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      uri: 'https://usebaci.com/ogabassey/checkout/bnpl?gateway=klump',
    });
  });

  it('rewrites Next.js RSC requests back to document navigations', () => {
    expect(
      resolveBNPLDocumentNavigation({
        apiBaseUrl: 'https://usebaci.com',
        currentDocumentUrl:
          'https://usebaci.com/ogabassey/checkout/bnpl?gateway=credit_direct&orderId=order-1',
        requestUrl:
          'https://usebaci.com/ogabassey/checkout/bnpl?gateway=credit_direct&orderId=order-1&_rsc=abc123',
      })
    ).toEqual({
      nextUrl:
        'https://usebaci.com/ogabassey/checkout/bnpl?gateway=credit_direct&orderId=order-1',
      reason: 'rewrite',
      shouldStart: false,
    });
  });

  it('blocks untrusted BNPL top-frame navigations', () => {
    expect(
      resolveBNPLDocumentNavigation({
        apiBaseUrl: 'https://usebaci.com',
        currentDocumentUrl:
          'https://usebaci.com/ogabassey/checkout/bnpl?gateway=credit_direct&orderId=order-1',
        isTopFrame: true,
        requestUrl: 'https://evil.example/checkout',
      })
    ).toEqual({
      nextUrl: 'https://evil.example/checkout',
      reason: 'untrusted',
      shouldStart: false,
    });
  });

  it('allows provider subframe navigations without replacing the document URL', () => {
    expect(
      resolveBNPLDocumentNavigation({
        apiBaseUrl: 'https://usebaci.com',
        currentDocumentUrl:
          'https://usebaci.com/ogabassey/checkout/bnpl?gateway=credit_direct&orderId=order-1',
        isTopFrame: false,
        requestUrl: 'https://connect.mono.co/widget/session-123',
      })
    ).toEqual({
      reason: 'allowed',
      shouldStart: true,
    });
  });

  it('allows provider navigations that are outside the Baci document origin', () => {
    expect(
      resolveBNPLDocumentNavigation({
        apiBaseUrl: 'https://usebaci.com',
        currentDocumentUrl:
          'https://usebaci.com/ogabassey/checkout/bnpl?gateway=credit_direct&orderId=order-1',
        isTopFrame: true,
        requestUrl: 'https://connect.withmono.com/widget/session-123',
      })
    ).toEqual({
      reason: 'allowed',
      shouldStart: true,
    });
    expect(
      resolveBNPLDocumentNavigation({
        apiBaseUrl: 'https://usebaci.com',
        currentDocumentUrl:
          'https://usebaci.com/ogabassey/checkout/bnpl?gateway=credit_direct&orderId=order-1',
        requestUrl: 'https://checkout.creditdirect.ng/bnpl/#/session',
      })
    ).toEqual({
      reason: 'allowed',
      shouldStart: true,
    });
  });

  it('allows custom domain matches when merchantDomain is provided', () => {
    expect(
      resolveBNPLDocumentNavigation({
        apiBaseUrl: 'https://usebaci.com',
        currentDocumentUrl:
          'https://usebaci.com/ogabassey/checkout/bnpl?gateway=credit_direct&orderId=order-1',
        isTopFrame: true,
        requestUrl:
          'https://ogabassey.com/checkout/bnpl?gateway=credit_direct&orderId=order-1',
        merchantSlug: 'ogabassey',
        merchantDomain: 'ogabassey.com',
      })
    ).toEqual({
      nextUrl:
        'https://ogabassey.com/checkout/bnpl?gateway=credit_direct&orderId=order-1',
      reason: 'allowed',
      shouldStart: true,
    });
  });

  it('blocks trusted merchant home navigations so cancellation returns to the app', () => {
    expect(
      resolveBNPLDocumentNavigation({
        apiBaseUrl: 'https://usebaci.com',
        currentDocumentUrl:
          'https://usebaci.com/ogabassey/checkout/bnpl?gateway=credit_direct&orderId=order-1',
        isTopFrame: true,
        requestUrl: 'https://ogabassey.com/',
        merchantSlug: 'ogabassey',
        merchantDomain: 'ogabassey.com',
      })
    ).toEqual({
      nextUrl: 'https://ogabassey.com/',
      reason: 'return-to-app',
      shouldStart: false,
    });
  });

  it('blocks custom domain matches when no merchantDomain is provided', () => {
    expect(
      resolveBNPLDocumentNavigation({
        apiBaseUrl: 'https://usebaci.com',
        currentDocumentUrl:
          'https://usebaci.com/ogabassey/checkout/bnpl?gateway=credit_direct&orderId=order-1',
        isTopFrame: true,
        requestUrl:
          'https://ogabassey.com/checkout/bnpl?gateway=credit_direct&orderId=order-1',
        merchantSlug: 'ogabassey',
      })
    ).toEqual({
      nextUrl:
        'https://ogabassey.com/checkout/bnpl?gateway=credit_direct&orderId=order-1',
      reason: 'untrusted',
      shouldStart: false,
    });

    expect(
      resolveBNPLDocumentNavigation({
        apiBaseUrl: 'https://usebaci.com',
        currentDocumentUrl:
          'https://usebaci.com/ogabassey/checkout/bnpl?gateway=credit_direct&orderId=order-1',
        isTopFrame: true,
        requestUrl:
          'https://evil.example/checkout/bnpl?gateway=credit_direct&orderId=order-1',
        merchantSlug: 'evil.example',
      })
    ).toEqual({
      nextUrl:
        'https://evil.example/checkout/bnpl?gateway=credit_direct&orderId=order-1',
      reason: 'untrusted',
      shouldStart: false,
    });
  });
});

describe('isBNPLCheckoutExitUrl', () => {
  it('matches trusted merchant URLs that leave the BNPL checkout document', () => {
    expect(
      isBNPLCheckoutExitUrl({
        apiBaseUrl: 'https://usebaci.com',
        merchantDomain: 'ogabassey.com',
        merchantSlug: 'ogabassey',
        url: 'https://ogabassey.com/',
      })
    ).toBe(true);

    expect(
      isBNPLCheckoutExitUrl({
        apiBaseUrl: 'https://usebaci.com',
        merchantSlug: 'ogabassey',
        url: 'https://usebaci.com/ogabassey/cart',
      })
    ).toBe(true);
  });

  it('does not treat checkout or outcome URLs as app exits', () => {
    const input = {
      apiBaseUrl: 'https://usebaci.com',
      merchantDomain: 'ogabassey.com',
      merchantSlug: 'ogabassey',
    };

    expect(
      isBNPLCheckoutExitUrl({
        ...input,
        url: 'https://ogabassey.com/checkout/bnpl?gateway=klump&orderId=order-1',
      })
    ).toBe(false);
    expect(
      isBNPLCheckoutExitUrl({
        ...input,
        url: 'https://ogabassey.com/order-success?reference=BAC-123',
      })
    ).toBe(false);
    expect(
      isBNPLCheckoutExitUrl({
        ...input,
        url: 'https://ogabassey.com/checkout?cancelled=true',
      })
    ).toBe(false);
  });
});

describe('BNPL_INJECTED_JAVASCRIPT', () => {
  it('captures resource error events so failed provider scripts are reported', () => {
    expect(BNPL_INJECTED_JAVASCRIPT).toMatch(
      /window\.addEventListener\('error',\s*function\(event\)[\s\S]*}, true\);/
    );
  });

  it('allows same-origin close bridge messages through to React Native', () => {
    expect(BNPL_INJECTED_JAVASCRIPT).toContain("'bnpl_close'");
  });

  it('captures window.open calls before native popup handling', () => {
    expect(BNPL_INJECTED_JAVASCRIPT).toContain("message: 'window.open called'");
  });
});

describe('getBNPLDebugUrlDetails', () => {
  it('returns structured URL details for popup diagnostics', () => {
    expect(
      getBNPLDebugUrlDetails(
        'https://checkout.paystack.com/pay/abc?reference=ref_123#step'
      )
    ).toEqual({
      hasHash: true,
      hasSearch: true,
      hostname: 'checkout.paystack.com',
      origin: 'https://checkout.paystack.com',
      parsed: true,
      pathname: '/pay/abc',
      protocol: 'https:',
      rawUrl: 'https://checkout.paystack.com/pay/abc?reference=ref_123#step',
      searchKeys: ['reference'],
    });
  });

  it('returns empty diagnostics for missing popup URLs', () => {
    expect(getBNPLDebugUrlDetails()).toEqual({
      parsed: false,
      rawUrl: '',
      reason: 'empty',
    });
    expect(getBNPLDebugUrlDetails('')).toEqual({
      parsed: false,
      rawUrl: '',
      reason: 'empty',
    });
  });

  it('returns invalid diagnostics for malformed popup URLs', () => {
    expect(getBNPLDebugUrlDetails('not a url')).toEqual({
      parsed: false,
      rawUrl: 'not a url',
      reason: 'invalid-url',
    });
  });
});

describe('buildBNPLCheckoutUrl', () => {
  it('preserves the validated amount for non-Klump BNPL checkout URLs', () => {
    const params = parseBNPLParams({
      amount: '386284.93',
      customerEmail: 'test@example.com',
      customerName: 'Test Customer',
      customerPhone: '+2348012345678',
      gateway: 'credit_direct',
      merchantSlug: 'ogabassey',
      orderId: 'order-123',
      trackingToken: 'track-123',
    });

    const url = new URL(
      buildBNPLCheckoutUrl({
        apiBaseUrl: 'https://usebaci.com',
        params,
      })
    );

    expect(url.pathname).toBe('/ogabassey/checkout/bnpl');
    expect(url.searchParams.get('gateway')).toBe('credit_direct');
    expect(url.searchParams.get('orderId')).toBe('order-123');
    expect(url.searchParams.get('amount')).toBe('386284.93');
  });
});

describe('areBNPLCheckoutUrlsEquivalent', () => {
  it('returns true for equivalent platform and custom domain URLs', () => {
    const urlA =
      'https://ogabassey.com/checkout/bnpl?gateway=credit_direct&orderId=order-123&amount=250000';
    const urlB =
      'https://usebaci.com/ogabassey/checkout/bnpl?gateway=credit_direct&orderId=order-123&amount=250000';
    expect(areBNPLCheckoutUrlsEquivalent(urlA, urlB, 'ogabassey')).toBe(true);
  });

  it('ignores volatile parameters like _rsc and _nocache', () => {
    const urlA =
      'https://ogabassey.com/checkout/bnpl?gateway=credit_direct&orderId=order-123&_rsc=abc123';
    const urlB =
      'https://usebaci.com/ogabassey/checkout/bnpl?gateway=credit_direct&orderId=order-123&_nocache=1234567';
    expect(areBNPLCheckoutUrlsEquivalent(urlA, urlB, 'ogabassey')).toBe(true);
  });

  it('does not require duplicated merchant slug query params across domain redirects', () => {
    const urlA =
      'https://ogabassey.com/checkout/bnpl?gateway=credit_direct&orderId=order-123&token=track-123';
    const urlB =
      'https://usebaci.com/ogabassey/checkout/bnpl?gateway=credit_direct&merchant_slug=ogabassey&orderId=order-123&token=track-123';

    expect(areBNPLCheckoutUrlsEquivalent(urlA, urlB, 'ogabassey')).toBe(true);
  });

  it('does not treat a different merchant context as the current checkout document', () => {
    const urlA =
      'https://ogabassey.com/checkout/bnpl?gateway=credit_direct&merchant_slug=other-store&orderId=order-123&token=track-123';
    const urlB =
      'https://usebaci.com/ogabassey/checkout/bnpl?gateway=credit_direct&merchant_slug=ogabassey&orderId=order-123&token=track-123';

    expect(areBNPLCheckoutUrlsEquivalent(urlA, urlB, 'ogabassey')).toBe(false);
  });

  it('ignores launch-only params that may be omitted across domain redirects', () => {
    const urlA =
      'https://ogabassey.com/checkout/bnpl?gateway=credit_direct&orderId=order-123';
    const urlB =
      'https://usebaci.com/ogabassey/checkout/bnpl?gateway=credit_direct&orderId=order-123&amount=250000&email=customer%40example.com&token=track-123';
    expect(areBNPLCheckoutUrlsEquivalent(urlA, urlB, 'ogabassey')).toBe(true);
  });

  it('returns false if an outcome parameter is present', () => {
    const urlA =
      'https://ogabassey.com/checkout/bnpl?gateway=credit_direct&orderId=order-123&error=cancelled';
    const urlB =
      'https://usebaci.com/ogabassey/checkout/bnpl?gateway=credit_direct&orderId=order-123';
    expect(areBNPLCheckoutUrlsEquivalent(urlA, urlB, 'ogabassey')).toBe(false);
  });

  it('returns false when orderId is missing from one checkout URL', () => {
    const urlA =
      'https://ogabassey.com/checkout/bnpl?gateway=credit_direct&orderId=order-123';
    const urlB =
      'https://usebaci.com/ogabassey/checkout/bnpl?gateway=credit_direct';

    expect(areBNPLCheckoutUrlsEquivalent(urlA, urlB, 'ogabassey')).toBe(false);
  });

  it('returns false when checkout orderId values differ', () => {
    const urlA =
      'https://ogabassey.com/checkout/bnpl?gateway=credit_direct&orderId=order-123';
    const urlB =
      'https://usebaci.com/ogabassey/checkout/bnpl?gateway=credit_direct&orderId=order-456';

    expect(areBNPLCheckoutUrlsEquivalent(urlA, urlB, 'ogabassey')).toBe(false);
  });

  it('returns false when gateway is missing from one checkout URL', () => {
    const urlA =
      'https://ogabassey.com/checkout/bnpl?gateway=credit_direct&orderId=order-123';
    const urlB =
      'https://usebaci.com/ogabassey/checkout/bnpl?orderId=order-123';

    expect(areBNPLCheckoutUrlsEquivalent(urlA, urlB, 'ogabassey')).toBe(false);
  });

  it('returns false when checkout gateway values differ', () => {
    const urlA =
      'https://ogabassey.com/checkout/bnpl?gateway=credit_direct&orderId=order-123';
    const urlB =
      'https://usebaci.com/ogabassey/checkout/bnpl?gateway=klump&orderId=order-123';

    expect(areBNPLCheckoutUrlsEquivalent(urlA, urlB, 'ogabassey')).toBe(false);
  });

  it('returns false if pathnames do not normalize to checkout/bnpl', () => {
    const urlA =
      'https://ogabassey.com/products/gadget?gateway=credit_direct&orderId=order-123';
    const urlB =
      'https://usebaci.com/ogabassey/products/gadget?gateway=credit_direct&orderId=order-123';
    expect(areBNPLCheckoutUrlsEquivalent(urlA, urlB, 'ogabassey')).toBe(false);
  });

  it('does not treat another merchant BNPL path as the current merchant document', () => {
    const urlA =
      'https://usebaci.com/other-merchant/checkout/bnpl?gateway=credit_direct&orderId=order-123';
    const urlB =
      'https://usebaci.com/ogabassey/checkout/bnpl?gateway=credit_direct&orderId=order-123';

    expect(areBNPLCheckoutUrlsEquivalent(urlA, urlB, 'ogabassey')).toBe(false);
  });

  it('returns false for invalid URL formats', () => {
    expect(
      areBNPLCheckoutUrlsEquivalent('not-a-url', 'https://usebaci.com')
    ).toBe(false);
  });
});
