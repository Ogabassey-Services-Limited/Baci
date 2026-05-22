import {
  AGENTIC_PAYMENT_METHOD_PAY_ON_DELIVERY,
  AGENTIC_PAYMENT_METHOD_PAYSTACK_BANK_TRANSFER,
  type AgenticPaymentMethod,
} from '@/config/agentic-payment-methods';
import { STOREFRONT_AGENT_ROUTES } from '@/config/storefront-agent-routes';
import type { AgentCommerceManifest } from '@/lib/agentic/agent-commerce-manifest';

export const ACP_DISCOVERY_CACHE_CONTROL = 'public, max-age=3600';
const DEFAULT_ACP_PROTOCOL_VERSION = '2026-04-30';

const CHECKOUT_SESSION_CAPABILITIES = [
  'checkout.session.create',
  'checkout.session.read',
  'checkout.session.update',
  'checkout.session.complete',
  'checkout.session.cancel',
] as const;

const PAYMENT_METHOD_CURRENCIES: Record<
  AgenticPaymentMethod,
  readonly string[]
> = {
  [AGENTIC_PAYMENT_METHOD_PAY_ON_DELIVERY]: ['NGN'],
  [AGENTIC_PAYMENT_METHOD_PAYSTACK_BANK_TRANSFER]: ['NGN'],
};

const CURRENCY_LOCALES: Record<string, readonly string[]> = {
  NGN: ['en-NG'],
};

const buildUrl = (baseUrl: string, path: string): string =>
  new URL(path, baseUrl).toString();

export function buildAcpDiscoveryProfile(manifest: AgentCommerceManifest) {
  const supportedVersions = getSupportedVersions(manifest);
  const supportedCurrencies = getSupportedCurrencies(manifest);

  return {
    protocol: {
      name: 'acp',
      version: supportedVersions.at(-1) ?? manifest.schema_version,
      supported_versions: supportedVersions,
      documentation_url: manifest.links.agent_native_commerce,
    },
    api_base_url: buildUrl(
      manifest.store.canonical_origin,
      STOREFRONT_AGENT_ROUTES.agenticApiBase
    ),
    transports: ['rest'],
    capabilities: {
      services: getAcpServices(manifest),
      supported_currencies: supportedCurrencies,
      supported_locales: getSupportedLocales(supportedCurrencies),
    },
  };
}

function getSupportedVersions(manifest: AgentCommerceManifest): string[] {
  const versions = new Set(
    [
      ...(manifest.auth?.supported_api_versions ?? []),
      manifest.schema_version,
    ].filter(
      (value): value is string =>
        typeof value === 'string' && value.trim().length > 0
    )
  );

  return versions.size > 0
    ? [...versions].sort()
    : [DEFAULT_ACP_PROTOCOL_VERSION];
}

function getAcpServices(manifest: AgentCommerceManifest): string[] {
  const services: string[] = [];

  if (hasCheckoutCapabilities(manifest) && hasCheckoutLinks(manifest)) {
    services.push('checkout');
  }

  if (
    manifest.capabilities.includes('order.read') &&
    typeof manifest.links.order === 'string' &&
    manifest.links.order.trim().length > 0
  ) {
    services.push('orders');
  }

  return services;
}

function getSupportedCurrencies(manifest: AgentCommerceManifest): string[] {
  const currencies = new Set<string>();

  for (const paymentMethod of manifest.payment_methods) {
    for (const currency of PAYMENT_METHOD_CURRENCIES[paymentMethod] ?? []) {
      currencies.add(currency);
    }
  }

  return [...currencies].sort();
}

function getSupportedLocales(supportedCurrencies: string[]): string[] {
  const locales = new Set<string>();

  for (const currency of supportedCurrencies) {
    for (const locale of CURRENCY_LOCALES[currency] ?? []) {
      locales.add(locale);
    }
  }

  return [...locales].sort();
}

function hasCheckoutLinks(manifest: AgentCommerceManifest): boolean {
  return [
    manifest.links.checkout_sessions,
    manifest.links.checkout_session,
    manifest.links.checkout_session_complete,
    manifest.links.checkout_session_cancel,
  ].every((value) => typeof value === 'string' && value.trim().length > 0);
}

function hasCheckoutCapabilities(manifest: AgentCommerceManifest): boolean {
  return CHECKOUT_SESSION_CAPABILITIES.every((capability) =>
    manifest.capabilities.includes(capability)
  );
}
