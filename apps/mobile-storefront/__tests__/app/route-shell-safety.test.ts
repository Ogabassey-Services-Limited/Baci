import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const APP_ROOT = path.resolve(__dirname, '../../app');
const ROUTE_MODULE_EXTENSION_PATTERN =
  /\.(?:(?:android|ios|native|web)\.)?(ts|tsx|js|jsx)$/;
const ROUTE_PLATFORM_SEGMENT_PATTERN =
  /\.(android|ios|native|web)\.(ts|tsx|js|jsx)$/;
const EXPO_ROUTER_SPECIAL_FILES = new Set([
  '+html.ts',
  '+html.tsx',
  '+html.js',
  '+html.jsx',
  '+middleware.ts',
  '+middleware.tsx',
  '+middleware.js',
  '+middleware.jsx',
  '+native-intent.ts',
  '+native-intent.tsx',
  '+native-intent.js',
  '+native-intent.jsx',
  '+not-found.ts',
  '+not-found.tsx',
  '+not-found.js',
  '+not-found.jsx',
]);

const EXPLICIT_STATIC_ROUTES = new Set([
  '(tabs)/account.tsx',
  '(tabs)/cart.tsx',
  '(tabs)/categories.tsx',
  '(tabs)/saved.tsx',
  '(tabs)/wallet.tsx',
  'auth/callback.tsx',
  'auth/login.tsx',
  'checkout.tsx',
  'notifications.tsx',
  'order-success.tsx',
  'profile/delete-account.tsx',
  'profile/edit.tsx',
  'search.tsx',
  'utilities/history.tsx',
]);

// Decreasing baseline: every route listed here currently does not render
// StorefrontScreenShell. As routes migrate, this list must shrink.
const SHELL_EXEMPT_ROUTES = new Set([
  '(tabs)/cart.tsx',
  '(tabs)/categories.tsx',
  '(tabs)/index.tsx',
  '(tabs)/wallet.tsx',
  'addresses/[id].tsx',
  'auth/callback.tsx',
  'auth/login.tsx',
  'bank-transfer/index.tsx',
  'bnpl-checkout/index.tsx',
  'checkout.tsx',
  'compare/index.tsx',
  'crypto-payment/index.tsx',
  'faq/index.tsx',
  'imei-check/index.tsx',
  'order-success.tsx',
  'orders/[id].tsx',
  'orders/index.tsx',
  'payment-gateway/index.tsx',
  'product/[slug].tsx',
  'profile/delete-account.tsx',
  'profile/edit.tsx',
  'receipts/index.tsx',
  'repairs/index.tsx',
  'saved/index.tsx',
  'search.tsx',
  'swap/index.tsx',
  'track-order/index.tsx',
  'utilities/[type].tsx',
]);

function collectModuleFiles(currentPath: string): string[] {
  return readdirSync(currentPath, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(currentPath, entry.name);

    if (entry.isDirectory()) {
      return collectModuleFiles(entryPath);
    }

    if (!ROUTE_MODULE_EXTENSION_PATTERN.test(entry.name)) {
      return [];
    }

    const relativePath = path.relative(APP_ROOT, entryPath);
    return [relativePath.split(path.sep).join('/')];
  });
}

function normalizeRouteModulePath(relativePath: string) {
  return relativePath.replace(ROUTE_PLATFORM_SEGMENT_PATTERN, '.$2');
}

function isRouteFile(relativePath: string): boolean {
  const routePath = normalizeRouteModulePath(relativePath);
  const fileName = path.basename(routePath);

  if (EXPO_ROUTER_SPECIAL_FILES.has(fileName)) {
    return true;
  }

  if (/^_layout\.(ts|tsx|js|jsx)$/.test(fileName)) {
    return true;
  }

  if (/^index\.(ts|tsx|js|jsx)$/.test(fileName)) {
    return true;
  }

  if (/^.+\+api\.(ts|tsx|js|jsx)$/.test(fileName)) {
    return true;
  }

  if (
    /^(?:\[[a-zA-Z0-9_-]+\]|\[\.\.\.[a-zA-Z0-9_-]+\]|\[\[\.\.\.[a-zA-Z0-9_-]+\]\])\.(ts|tsx|js|jsx)$/.test(
      fileName
    )
  ) {
    return true;
  }

  return EXPLICIT_STATIC_ROUTES.has(routePath);
}

function isShellCheckRoute(routePath: string) {
  const fileName = path.basename(routePath);
  if (EXPO_ROUTER_SPECIAL_FILES.has(fileName)) return false;
  return !/^_layout\.(ts|tsx|js|jsx)$/.test(fileName);
}

function routeUsesStorefrontScreenShell(routePath: string) {
  const absolutePath = path.join(APP_ROOT, routePath);
  const source = readFileSync(absolutePath, 'utf8');
  return source.includes('StorefrontScreenShell');
}

describe('app route shell safety', () => {
  it('keeps StorefrontScreenShell coverage from regressing', () => {
    const routeFiles = collectModuleFiles(APP_ROOT)
      .filter((filePath) => isRouteFile(filePath))
      .map(normalizeRouteModulePath)
      .filter(isShellCheckRoute);

    const routesWithoutShell = routeFiles.filter(
      (routePath) => !routeUsesStorefrontScreenShell(routePath)
    );

    const unexpectedRoutesWithoutShell = routesWithoutShell.filter(
      (routePath) => !SHELL_EXEMPT_ROUTES.has(routePath)
    );

    const staleExemptions = [...SHELL_EXEMPT_ROUTES]
      .filter((routePath) => routeFiles.includes(routePath))
      .filter(routeUsesStorefrontScreenShell);

    if (unexpectedRoutesWithoutShell.length > 0 || staleExemptions.length > 0) {
      throw new Error(
        [
          'Storefront route shell safety check failed.',
          '',
          ...(unexpectedRoutesWithoutShell.length > 0
            ? [
                'Routes missing StorefrontScreenShell that are not in the exemption baseline:',
                ...unexpectedRoutesWithoutShell.map((routePath) => `- ${routePath}`),
                '',
                'Either migrate the route to StorefrontScreenShell, or add a justified temporary exemption.',
                '',
              ]
            : []),
          ...(staleExemptions.length > 0
            ? [
                'Stale StorefrontScreenShell exemptions (route now uses shell; remove from SHELL_EXEMPT_ROUTES):',
                ...staleExemptions.map((routePath) => `- ${routePath}`),
              ]
            : []),
        ].join('\n')
      );
    }

    expect(unexpectedRoutesWithoutShell).toEqual([]);
    expect(staleExemptions).toEqual([]);
  });
});
