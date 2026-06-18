import { describe, expect, it, vi } from 'vitest';
import {
  buildPostHogClientConfig,
  resolvePostHogWebTenantContext,
  sanitizePostHogCapture,
  sanitizePostHogProperties,
} from './client-config';

describe('PostHog client config', () => {
  it('enables web vitals, exception capture, and privacy-safe replay defaults', () => {
    const config = buildPostHogClientConfig({
      NEXT_PUBLIC_POSTHOG_PROXY_PATH: '/baci-observe',
      NEXT_PUBLIC_POSTHOG_UI_HOST: 'https://eu.posthog.com',
      NODE_ENV: 'production',
    });

    expect(config).toMatchObject({
      api_host: '/baci-observe',
      ui_host: 'https://eu.posthog.com',
      defaults: '2026-05-30',
      autocapture: true,
      capture_dead_clicks: true,
      capture_heatmaps: true,
      capture_exceptions: {
        capture_unhandled_errors: true,
        capture_unhandled_rejections: true,
        capture_console_errors: false,
      },
      capture_performance: {
        web_vitals: true,
        web_vitals_allowed_metrics: ['LCP', 'CLS', 'FCP', 'INP'],
        web_vitals_attribution: true,
        network_timing: false,
      },
      mask_all_text: true,
      mask_all_element_attributes: true,
      session_recording: expect.objectContaining({
        maskAllInputs: true,
        maskTextFn: expect.any(Function),
        maskTextSelector: 'body',
      }),
    });
    expect(config.session_recording?.maskTextFn?.('private note')).toBe(
      '[Filtered]'
    );
  });

  it('registers stable app and tenant context after PostHog loads', () => {
    const config = buildPostHogClientConfig({
      NODE_ENV: 'production',
      NEXT_PUBLIC_ROOT_DOMAIN: 'usebaci.com',
    });
    const register = vi.fn();
    vi.stubGlobal('location', {
      hostname: 'ogabassey.usebaci.com',
      pathname: '/products/iphone',
    });

    config.loaded?.({
      register,
    } as never);

    expect(register).toHaveBeenCalledWith({
      app_surface: 'web',
      deployment_environment: 'production',
      merchant_domain: 'ogabassey.usebaci.com',
      merchant_slug: 'ogabassey',
    });
    vi.unstubAllGlobals();
  });

  it('derives merchant context from storefront URL shapes', () => {
    expect(
      resolvePostHogWebTenantContext(
        { NEXT_PUBLIC_ROOT_DOMAIN: 'usebaci.com' },
        { hostname: 'usebaci.com', pathname: '/ogabassey/products/iphone' }
      )
    ).toEqual({ merchant_slug: 'ogabassey' });

    expect(
      resolvePostHogWebTenantContext(
        { NEXT_PUBLIC_ROOT_DOMAIN: 'usebaci.com' },
        { hostname: 'ogabassey.com', pathname: '/products/iphone' }
      )
    ).toEqual({ merchant_domain: 'ogabassey.com' });

    expect(
      resolvePostHogWebTenantContext(
        { NEXT_PUBLIC_ROOT_DOMAIN: 'usebaci.com' },
        { hostname: 'usebaci.com', pathname: '/dashboard' }
      )
    ).toEqual({});
  });

  it('does not stamp platform routes or reserved subdomains as merchants', () => {
    for (const pathname of [
      '/about',
      '/contact',
      '/features',
      '/invite/invite_token_123',
      '/privacy',
      '/staff/accept',
      '/terms',
    ]) {
      expect(
        resolvePostHogWebTenantContext(
          { NEXT_PUBLIC_ROOT_DOMAIN: 'usebaci.com' },
          { hostname: 'usebaci.com', pathname }
        )
      ).toEqual({});
    }

    for (const hostname of [
      'app.usebaci.com',
      'dashboard.usebaci.com',
      'api.usebaci.com',
    ]) {
      expect(
        resolvePostHogWebTenantContext(
          { NEXT_PUBLIC_ROOT_DOMAIN: 'usebaci.com' },
          { hostname, pathname: '/checkout' }
        )
      ).toEqual({});
    }
  });

  it('redacts sensitive property names, emails, and URL query strings', () => {
    expect(
      sanitizePostHogProperties({
        email: 'buyer@example.com',
        note: 'Contact buyer@example.com and support@example.com before delivery',
        $current_url: 'https://ogabassey.com/cart?token=secret#checkout',
        $el_text: 'Jane Buyer, 12 Checkout Street',
        $elements_chain: 'button:contains("Jane Buyer paid order")',
        $elements: [
          {
            tag_name: 'button',
            text: 'Jane Buyer paid order',
            'attr__aria-label': 'Pay Jane Buyer',
            href: '/checkout?email=buyer@example.com',
          },
        ],
        request_path: '/checkout/success?email=buyer@example.com',
        $session_id: '018f-session',
        shipping: 2500,
        shipping_fee: 2500,
        shippingPin: '1234',
        card_number: 'test_card_number',
        nested: {
          phone: '+2348000000000',
          path: '/checkout',
        },
      })
    ).toEqual({
      email: '[Filtered]',
      note: 'Contact [Filtered] and [Filtered] before delivery',
      $current_url: 'https://ogabassey.com/cart',
      $el_text: '[Filtered]',
      $elements_chain: '[Filtered]',
      $elements: [
        {
          tag_name: 'button',
          text: '[Filtered]',
          'attr__aria-label': '[Filtered]',
          href: '/checkout',
        },
      ],
      request_path: '/checkout/success',
      $session_id: '018f-session',
      shipping: 2500,
      shipping_fee: 2500,
      shippingPin: '[Filtered]',
      card_number: '[Filtered]',
      nested: {
        phone: '[Filtered]',
        path: '/checkout',
      },
    });
  });

  it('sanitizes capture payloads before sending', () => {
    expect(
      sanitizePostHogCapture({
        uuid: 'event-1',
        event: '$pageview',
        properties: {
          $current_url: 'https://ogabassey.com/?email=buyer@example.com',
        },
        $set: {
          phone: '+2348000000000',
        },
        $set_once: {
          first_seen_url: 'https://ogabassey.com/?utm_source=test',
        },
      })
    ).toMatchObject({
      properties: {
        $current_url: 'https://ogabassey.com/',
      },
      $set: {
        phone: '[Filtered]',
      },
      $set_once: {
        first_seen_url: 'https://ogabassey.com/',
      },
    });
  });

  it('stamps capture payloads with tenant context from the current browser route', () => {
    vi.stubGlobal('location', {
      hostname: 'usebaci.com',
      pathname: '/ogabassey/products/iphone',
    });

    const capture = sanitizePostHogCapture({
      uuid: 'event-1',
      event: '$web_vitals',
      properties: {
        merchant_domain: 'old-merchant.example',
        merchant_slug: 'old-merchant',
      },
    });

    expect(capture?.properties).toMatchObject({
      merchant_slug: 'ogabassey',
    });
    expect(capture?.properties).not.toHaveProperty('merchant_domain');
    vi.unstubAllGlobals();
  });

  it('removes stale tenant context from capture payloads on platform routes', () => {
    vi.stubGlobal('location', {
      hostname: 'usebaci.com',
      pathname: '/staff/accept',
    });

    const capture = sanitizePostHogCapture({
      uuid: 'event-1',
      event: '$pageview',
      properties: {
        merchant_domain: 'ogabassey.com',
        merchant_slug: 'ogabassey',
      },
    });

    expect(capture?.properties).not.toHaveProperty('merchant_domain');
    expect(capture?.properties).not.toHaveProperty('merchant_slug');
    vi.unstubAllGlobals();
  });

  it('scrubs auto-captured exception payload values before sending', () => {
    expect(
      sanitizePostHogCapture({
        uuid: 'event-1',
        event: '$exception',
        properties: {
          $exception_list: [
            {
              type: 'Error',
              value:
                'checkout failed at https://ogabassey.com/order-success?trackingToken=track_secret&reference=ref_1234567 for buyer@example.com',
              stacktrace: {
                frames: [
                  {
                    filename:
                      'https://ogabassey.com/_next/static/chunk.js?token=raw_secret',
                    context_line: 'reference=ref_1234567',
                  },
                ],
              },
            },
          ],
        },
      })
    ).toMatchObject({
      properties: {
        $exception_list: [
          {
            value:
              'checkout failed at https://ogabassey.com/order-success for [Filtered]',
            stacktrace: {
              frames: [
                {
                  filename: 'https://ogabassey.com/_next/static/chunk.js',
                  context_line: 'reference=[Filtered]',
                },
              ],
            },
          },
        ],
      },
    });
  });
});
