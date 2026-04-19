import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const slugDirectory = dirname(fileURLToPath(import.meta.url));

const runtimeRouteManifest = [
  '(home)/page.tsx',
  '(home)/loading.tsx',
  '(catalog)/loading.tsx',
  '(catalog)/products/page.tsx',
  '(catalog)/products/[productSlug]/page.tsx',
  '(catalog)/products/[productSlug]/loading.tsx',
  '(catalog)/product/[productSlug]/page.tsx',
  '(catalog)/[category]/page.tsx',
  '(catalog)/[category]/[productSlug]/page.tsx',
  '(catalog)/[category]/[productSlug]/loading.tsx',
  '(catalog)/[category]/compare/[comparisonSlug]/loading.tsx',
  '(catalog)/[category]/best-under/[priceBandSlug]/loading.tsx',
  '(blog)/loading.tsx',
  '(blog)/blog/page.tsx',
  '(blog)/blog/[postSlug]/page.tsx',
  '(blog)/blog/[postSlug]/loading.tsx',
  '(content)/loading.tsx',
  '(content)/about/page.tsx',
  '(content)/contact/page.tsx',
  '(content)/faq/page.tsx',
  '(content)/privacy/page.tsx',
  '(content)/privacy-policy/page.tsx',
  '(content)/terms/page.tsx',
  '(content)/terms-of-service/page.tsx',
  '(content)/returns/page.tsx',
  '(content)/shipping/page.tsx',
  '(content)/warranty/page.tsx',
  '(content)/pages/about/page.tsx',
  '(content)/pages/blog/page.tsx',
  '(content)/pages/contact/page.tsx',
  '(content)/pages/faq/page.tsx',
  '(content)/pages/privacy/page.tsx',
  '(content)/pages/rewards/page.tsx',
  '(content)/pages/terms/page.tsx',
  '(commerce)/loading.tsx',
  '(commerce)/cart/page.tsx',
  '(commerce)/checkout/page.tsx',
  '(commerce)/checkout/bnpl/page.tsx',
  '(commerce)/checkout/crypto/page.tsx',
  '(commerce)/checkout/success/page.tsx',
  '(commerce)/order-success/page.tsx',
  '(commerce)/track-order/page.tsx',
  '(commerce)/wallet/page.tsx',
  '(commerce)/wishlist/page.tsx',
  '(customer)/loading.tsx',
  '(customer)/account/layout.tsx',
  '(customer)/account/page.tsx',
  '(customer)/account/addresses/page.tsx',
  '(customer)/account/callback/route.ts',
  '(customer)/account/login/page.tsx',
  '(customer)/account/orders/page.tsx',
  '(customer)/account/orders/[orderId]/page.tsx',
  '(customer)/account/orders/[orderId]/insurance/page.tsx',
  '(customer)/account/settings/page.tsx',
  '(customer)/delete-account/page.tsx',
  '(customer)/receipts/layout.tsx',
  '(customer)/receipts/page.tsx',
  '(utility)/loading.tsx',
  '(utility)/imei-check/page.tsx',
  '(utility)/member-status/page.tsx',
  '(utility)/repair/page.tsx',
  '(utility)/repairs/page.tsx',
  '(utility)/reviews/page.tsx',
  '(utility)/swap/page.tsx',
];

const legacyRouteManifest = [
  'about/page.tsx',
  'contact/page.tsx',
  'faq/page.tsx',
  'privacy/page.tsx',
  'privacy-policy/page.tsx',
  'terms/page.tsx',
  'terms-of-service/page.tsx',
  'returns/page.tsx',
  'shipping/page.tsx',
  'warranty/page.tsx',
  'pages/about/page.tsx',
  'pages/blog/page.tsx',
  'pages/contact/page.tsx',
  'pages/faq/page.tsx',
  'pages/privacy/page.tsx',
  'pages/rewards/page.tsx',
  'pages/terms/page.tsx',
  'cart/page.tsx',
  'checkout/page.tsx',
  'checkout/bnpl/page.tsx',
  'checkout/crypto/page.tsx',
  'checkout/success/page.tsx',
  'order-success/page.tsx',
  'track-order/page.tsx',
  'wallet/page.tsx',
  'wishlist/page.tsx',
  'account/layout.tsx',
  'account/page.tsx',
  'account/addresses/page.tsx',
  'account/callback/route.ts',
  'account/login/page.tsx',
  'account/orders/page.tsx',
  'account/orders/[orderId]/page.tsx',
  'account/orders/[orderId]/insurance/page.tsx',
  'account/settings/page.tsx',
  'delete-account/page.tsx',
  'receipts/layout.tsx',
  'receipts/page.tsx',
  'imei-check/page.tsx',
  'member-status/page.tsx',
  'repair/page.tsx',
  'repairs/page.tsx',
  'reviews/page.tsx',
  'swap/page.tsx',
];

const groupedFirstPaintOwnershipManifest = [
  {
    path: '(content)/about/page.tsx',
    forbiddenSnippets: ['Loading about page...'],
  },
  {
    path: '(content)/faq/page.tsx',
    forbiddenSnippets: ['Loading FAQ...'],
  },
  {
    path: '(content)/privacy/page.tsx',
    forbiddenSnippets: ['Loading privacy policy...'],
  },
  {
    path: '(content)/privacy-policy/page.tsx',
    forbiddenSnippets: ['Loading privacy policy...'],
  },
  {
    path: '(content)/terms/page.tsx',
    forbiddenSnippets: ['Loading terms of service...'],
  },
  {
    path: '(content)/terms-of-service/page.tsx',
    forbiddenSnippets: ['Loading terms of service...'],
  },
  {
    path: '(content)/pages/about/page.tsx',
    forbiddenSnippets: ['Loading about page...'],
  },
  {
    path: '(content)/pages/contact/page.tsx',
    forbiddenSnippets: ['Loading contact page...'],
  },
  {
    path: '(content)/pages/faq/page.tsx',
    forbiddenSnippets: ['Loading FAQ...'],
  },
  {
    path: '(content)/pages/privacy/page.tsx',
    forbiddenSnippets: ['Loading privacy policy...'],
  },
  {
    path: '(content)/pages/terms/page.tsx',
    forbiddenSnippets: ['Loading terms of service...'],
  },
  {
    path: '(commerce)/cart/page.tsx',
    forbiddenSnippets: ['StorefrontPageSkeleton', 'Suspense fallback'],
  },
  {
    path: '(commerce)/checkout/page.tsx',
    forbiddenSnippets: ['CheckoutLoading', 'Loading checkout...'],
  },
  {
    path: '(commerce)/checkout/bnpl/page.tsx',
    forbiddenSnippets: ['BnplLoading', 'Suspense fallback'],
  },
  {
    path: '(commerce)/checkout/crypto/page.tsx',
    forbiddenSnippets: ['CryptoLoading', 'Suspense fallback'],
  },
  {
    path: '(commerce)/track-order/page.tsx',
    forbiddenSnippets: ['fallback={<div>Loading...</div>}'],
  },
  {
    path: '(commerce)/wallet/page.tsx',
    forbiddenSnippets: [
      'Loading wallet...',
      '<h1 className="sr-only">Wallet</h1>',
    ],
  },
  {
    path: '(commerce)/wishlist/page.tsx',
    forbiddenSnippets: [
      'Loading wish list...',
      '<h1 className="sr-only">Your Wish List</h1>',
    ],
  },
  {
    path: '(customer)/delete-account/page.tsx',
    forbiddenSnippets: ['<span className="sr-only">Loading...</span>'],
  },
];

describe('storefront route groups', () => {
  it('exposes the runtime route entrypoints and loading boundaries for Tasks 3-5', () => {
    for (const routePath of runtimeRouteManifest) {
      expect(existsSync(resolve(slugDirectory, routePath))).toBe(true);
    }
  });

  it('removes the legacy root locations for the Task 5 route families', () => {
    for (const routePath of legacyRouteManifest) {
      expect(existsSync(resolve(slugDirectory, routePath))).toBe(false);
    }
  });

  it('lets route-group loading own first paint for moved Task 5 pages', () => {
    for (const {
      path,
      forbiddenSnippets,
    } of groupedFirstPaintOwnershipManifest) {
      const source = readFileSync(resolve(slugDirectory, path), 'utf8');

      for (const forbiddenSnippet of forbiddenSnippets) {
        expect(source).not.toContain(forbiddenSnippet);
      }
    }
  });
});
