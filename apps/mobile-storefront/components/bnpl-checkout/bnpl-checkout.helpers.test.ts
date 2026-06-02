import { describe, expect, it } from '@jest/globals';
import {
  buildBNPLDocumentSource,
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

  it('builds WebView document sources with an HTML accept header', () => {
    expect(
      buildBNPLDocumentSource(
        'https://usebaci.com/ogabassey/checkout/bnpl?gateway=klump&_rsc=abc123'
      )
    ).toEqual({
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
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
        requestUrl: 'https://checkout.creditdirect.ng/bnpl/#/session',
      })
    ).toEqual({
      reason: 'allowed',
      shouldStart: true,
    });
  });
});
