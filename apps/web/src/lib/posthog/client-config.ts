import type { CaptureResult, PostHogConfig, Properties } from 'posthog-js';
import {
  getPostHogProxyPath,
  getPostHogUiHost,
  type PostHogEnv,
} from '@/lib/posthog/config';
import { sanitizePostHogExceptionText } from '@/lib/posthog/exception-text';

const SENSITIVE_PROPERTY_TOKENS = new Set([
  'password',
  'passcode',
  'token',
  'secret',
  'authorization',
  'cookie',
  'otp',
  'pin',
  'cvv',
  'card',
  'bvn',
  'nin',
  'email',
  'phone',
  'address',
]);
const URL_PROPERTY_PATTERN =
  /(?:url|href|referrer|current_url|pathname|request_path)/i;
const AUTOCAPTURE_TEXT_PROPERTY_PATTERN =
  /^(?:\$el_text|\$elements_chain|text|attr__(?:aria-label|placeholder|title))$/i;
const EMAIL_VALUE_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const REDACTED_VALUE = '[Filtered]';
const QUERY_OR_HASH_PATTERN = /[?#]/;
const EXCEPTION_LIST_PROPERTY_KEY = '$exception_list';
const RESERVED_WEB_TENANT_SUBDOMAINS = new Set([
  'www',
  'app',
  'api',
  'admin',
  'dashboard',
  'mail',
  'smtp',
]);
const PLATFORM_ROOT_ROUTE_SEGMENTS = new Set([
  '',
  '_next',
  'about',
  'admin',
  'api',
  'auth',
  'blog',
  'builder',
  'cart',
  'checkout',
  'contact',
  'dashboard',
  'debug-auth',
  'delete-account',
  'demo',
  'developers',
  'favicon.ico',
  'features',
  'feeds',
  'invite',
  'login',
  'manifest.webmanifest',
  'onboarding',
  'pricing',
  'privacy',
  'products',
  'reset-password',
  'robots.txt',
  'signup',
  'sitemap.xml',
  'staff',
  'template-preview',
  'terms',
  'track',
]);
const VALID_MERCHANT_SUBDOMAIN_REGEX = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
const TENANT_CONTEXT_PROPERTY_KEYS = [
  'merchant_domain',
  'merchant_id',
  'merchant_slug',
] as const;

function isValidMerchantSlug(value: string): boolean {
  return (
    VALID_MERCHANT_SUBDOMAIN_REGEX.test(value) &&
    !RESERVED_WEB_TENANT_SUBDOMAINS.has(value) &&
    !PLATFORM_ROOT_ROUTE_SEGMENTS.has(value)
  );
}

interface BrowserLocationLike {
  hostname: string;
  pathname: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function redactUrlQuery(value: string): string {
  const markerIndex = value.search(QUERY_OR_HASH_PATTERN);
  return markerIndex === -1 ? value : value.slice(0, markerIndex);
}

function isSensitivePropertyKey(key: string): boolean {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .some((token) => SENSITIVE_PROPERTY_TOKENS.has(token));
}

function normalizeHostname(hostname: string): string {
  return (
    hostname
      .trim()
      .toLowerCase()
      .replace(/^www\./, '')
      .split(':')[0] ?? ''
  );
}

function normalizeRootDomain(env: PostHogEnv): string {
  return normalizeHostname(env.NEXT_PUBLIC_ROOT_DOMAIN || 'usebaci.com');
}

function isLocalOrPreviewHost(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.vercel.app')
  );
}

function getPathMerchantSlug(pathname: string): string | undefined {
  const slug = pathname.split('/').find(Boolean)?.toLowerCase();
  if (!slug || !isValidMerchantSlug(slug)) {
    return undefined;
  }

  return slug;
}

export function resolvePostHogWebTenantContext(
  env: PostHogEnv = process.env,
  location: BrowserLocationLike | undefined = typeof globalThis.location ===
  'undefined'
    ? undefined
    : globalThis.location
): Properties {
  if (!location) {
    return {};
  }

  const hostname = normalizeHostname(location.hostname);
  if (!hostname || isLocalOrPreviewHost(hostname)) {
    return {};
  }

  const rootDomain = normalizeRootDomain(env);
  const tenantContext: Properties = {};

  if (hostname === rootDomain) {
    const merchantSlug = getPathMerchantSlug(location.pathname);
    if (merchantSlug) {
      tenantContext.merchant_slug = merchantSlug;
    }

    return tenantContext;
  }

  if (hostname.endsWith(`.${rootDomain}`)) {
    const merchantSlug = hostname.slice(0, -(rootDomain.length + 1));
    if (isValidMerchantSlug(merchantSlug)) {
      tenantContext.merchant_slug = merchantSlug;
      tenantContext.merchant_domain = hostname;
    }

    return tenantContext;
  }

  tenantContext.merchant_domain = hostname;
  return tenantContext;
}

function sanitizeExceptionListValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return sanitizePostHogExceptionText(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeExceptionListValue(item));
  }

  if (isRecord(value)) {
    const sanitized = Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        sanitizeExceptionListValue(entryValue),
      ])
    );

    return sanitizePostHogProperties(sanitized);
  }

  return value;
}

function sanitizePropertyValue(key: string, value: unknown): unknown {
  if (key === EXCEPTION_LIST_PROPERTY_KEY) {
    return sanitizeExceptionListValue(value);
  }

  if (AUTOCAPTURE_TEXT_PROPERTY_PATTERN.test(key)) {
    return REDACTED_VALUE;
  }

  if (isSensitivePropertyKey(key)) {
    return REDACTED_VALUE;
  }

  if (typeof value === 'string') {
    if (URL_PROPERTY_PATTERN.test(key)) {
      return redactUrlQuery(value);
    }

    return value.replace(EMAIL_VALUE_PATTERN, REDACTED_VALUE);
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizePropertyValue(key, item));
  }

  if (isRecord(value)) {
    return sanitizePostHogProperties(value);
  }

  return value;
}

export function sanitizePostHogProperties(
  properties: Record<string, unknown> | undefined
): Properties | undefined {
  if (!properties) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(properties).map(([key, value]) => [
      key,
      sanitizePropertyValue(key, value),
    ])
  ) as Properties;
}

export function sanitizePostHogCapture(
  capture: CaptureResult | null
): CaptureResult | null {
  if (!capture) {
    return null;
  }

  const properties = sanitizePostHogProperties(capture.properties) ?? {};

  if (typeof globalThis.location !== 'undefined') {
    for (const key of TENANT_CONTEXT_PROPERTY_KEYS) {
      delete properties[key];
    }

    Object.assign(properties, resolvePostHogWebTenantContext());
  }

  return {
    ...capture,
    properties,
    $set: sanitizePostHogProperties(capture.$set),
    $set_once: sanitizePostHogProperties(capture.$set_once),
  };
}

export function buildPostHogClientConfig(
  env: PostHogEnv = process.env
): Partial<PostHogConfig> {
  return {
    api_host: getPostHogProxyPath(env),
    ui_host: getPostHogUiHost(env),
    defaults: '2026-05-30',
    autocapture: true,
    rageclick: true,
    capture_dead_clicks: true,
    capture_heatmaps: true,
    capture_pageview: false,
    capture_pageleave: false,
    mask_all_text: true,
    mask_all_element_attributes: true,
    capture_exceptions: {
      capture_unhandled_errors: true,
      capture_unhandled_rejections: true,
      capture_console_errors: false,
    },
    capture_performance: {
      web_vitals: true,
      web_vitals_allowed_metrics: ['LCP', 'CLS', 'FCP', 'INP'],
      web_vitals_delayed_flush_ms: 5000,
      web_vitals_attribution: true,
      network_timing: false,
    },
    disable_session_recording: false,
    session_recording: {
      maskAllInputs: true,
      maskTextFn: () => REDACTED_VALUE,
      maskTextSelector: 'body',
      blockSelector: '[data-ph-block], [data-session-replay-block]',
    },
    property_blacklist: [
      'password',
      'token',
      'secret',
      'authorization',
      'cookie',
      'otp',
      'pin',
      'cvv',
      'card_number',
      'bvn',
      'nin',
      'email',
      'phone',
      'address',
    ],
    before_send: sanitizePostHogCapture,
    loaded(posthog) {
      posthog.register({
        app_surface: 'web',
        deployment_environment:
          env.NEXT_PUBLIC_VERCEL_ENV || env.NODE_ENV || 'development',
        ...resolvePostHogWebTenantContext(env),
      });
    },
  };
}
