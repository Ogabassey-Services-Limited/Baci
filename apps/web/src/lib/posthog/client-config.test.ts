import { describe, expect, it, vi } from 'vitest';
import {
  buildPostHogClientConfig,
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
      session_recording: expect.objectContaining({
        maskAllInputs: true,
        maskTextSelector: 'body',
      }),
    });
  });

  it('registers stable app context after PostHog loads', () => {
    const config = buildPostHogClientConfig({
      NODE_ENV: 'production',
    });
    const register = vi.fn();

    config.loaded?.({
      register,
    } as never);

    expect(register).toHaveBeenCalledWith({
      app_surface: 'web',
      deployment_environment: 'production',
    });
  });

  it('redacts sensitive property names, emails, and URL query strings', () => {
    expect(
      sanitizePostHogProperties({
        email: 'buyer@example.com',
        note: 'Contact buyer@example.com and support@example.com before delivery',
        $current_url: 'https://ogabassey.com/cart?token=secret#checkout',
        request_path: '/checkout/success?email=buyer@example.com',
        $session_id: '018f-session',
        nested: {
          phone: '+2348000000000',
          path: '/checkout',
        },
      })
    ).toEqual({
      email: '[Filtered]',
      note: 'Contact [Filtered] and [Filtered] before delivery',
      $current_url: 'https://ogabassey.com/cart',
      request_path: '/checkout/success',
      $session_id: '018f-session',
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
});
