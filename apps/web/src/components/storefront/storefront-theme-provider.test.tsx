import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StorefrontThemeProvider } from './storefront-theme-provider';

const DOCUMENT_CLASSES = [
  'light',
  'storefront-light',
  'storefront-theme-scope',
  'storefront-variant-default',
  'storefront-variant-ogabassey',
  'storefront-mode-system',
];

const DOCUMENT_COUNT_ATTRS = [
  'data-storefront-light-mode-count',
  'data-storefront-light-count',
  'data-storefront-theme-scope-count',
  'data-storefront-variant-default-count',
  'data-storefront-variant-ogabassey-count',
  'data-storefront-mode-system-count',
];
const DOCUMENT_HYDRATION_READY_ATTR = 'data-storefront-theme-hydration-ready';
const DOCUMENT_ATTRS = [
  ...DOCUMENT_COUNT_ATTRS,
  ...DOCUMENT_COUNT_ATTRS.map((attr) => `${attr}-preexisting`),
  DOCUMENT_HYDRATION_READY_ATTR,
];

function cleanupDocumentThemeState() {
  for (const target of [document.documentElement, document.body]) {
    target.classList.remove(...DOCUMENT_CLASSES);

    for (const attr of DOCUMENT_ATTRS) {
      target.removeAttribute(attr);
    }
  }
}

function flushDeferredPortalThemeMode() {
  act(() => {
    vi.runOnlyPendingTimers();
  });
}

describe('StorefrontThemeProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    cleanupDocumentThemeState();
  });

  afterEach(() => {
    act(() => {
      vi.runOnlyPendingTimers();
    });
    vi.useRealTimers();
    cleanupDocumentThemeState();
  });

  it('renders children inside a themed wrapper', () => {
    render(
      <StorefrontThemeProvider>
        <main>Storefront content</main>
      </StorefrontThemeProvider>
    );

    expect(screen.getByRole('main')).toHaveTextContent('Storefront content');
  });

  it('keeps default storefronts on the existing forced-light class contract', () => {
    const { container } = render(
      <StorefrontThemeProvider>
        <span>child</span>
      </StorefrontThemeProvider>
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass('storefront-theme-scope');
    expect(wrapper).toHaveClass('storefront-variant-default');
    expect(wrapper).toHaveClass('light');
    expect(wrapper).toHaveClass('storefront-light');
    expect(wrapper).toHaveClass('contents');
    expect(wrapper).not.toHaveClass('storefront-mode-system');
  });

  it('allows OgaBassey to use system appearance without forced-light classes', () => {
    const { container } = render(
      <StorefrontThemeProvider
        appearance={{ mode: 'system', variant: 'ogabassey' }}
      >
        <span>child</span>
      </StorefrontThemeProvider>
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass('storefront-theme-scope');
    expect(wrapper).toHaveClass('storefront-variant-ogabassey');
    expect(wrapper).toHaveClass('storefront-mode-system');
    expect(wrapper).toHaveClass('contents');
    expect(wrapper).not.toHaveClass('light');
    expect(wrapper).not.toHaveClass('storefront-light');
  });

  it('defers document-level theme classes until after the hydration turn', () => {
    render(
      <StorefrontThemeProvider>
        <div>content</div>
      </StorefrontThemeProvider>
    );

    expect(document.documentElement).not.toHaveClass('storefront-theme-scope');
    expect(document.body).not.toHaveClass('storefront-theme-scope');
    expect(
      document.documentElement.getAttribute('data-storefront-theme-scope-count')
    ).toBeNull();
  });

  it('applies document classes immediately for later mounts after the hydration turn', () => {
    const first = render(
      <StorefrontThemeProvider>
        <div>first</div>
      </StorefrontThemeProvider>
    );

    expect(document.documentElement).not.toHaveClass('storefront-theme-scope');
    flushDeferredPortalThemeMode();
    expect(document.documentElement).toHaveClass('storefront-theme-scope');
    expect(document.documentElement).toHaveAttribute(
      DOCUMENT_HYDRATION_READY_ATTR,
      'true'
    );

    first.unmount();
    expect(document.documentElement).not.toHaveClass('storefront-theme-scope');
    expect(document.documentElement).toHaveAttribute(
      DOCUMENT_HYDRATION_READY_ATTR,
      'true'
    );

    render(
      <StorefrontThemeProvider
        appearance={{ mode: 'system', variant: 'ogabassey' }}
      >
        <div>second</div>
      </StorefrontThemeProvider>
    );

    expect(document.documentElement).toHaveClass('storefront-theme-scope');
    expect(document.documentElement).toHaveClass(
      'storefront-variant-ogabassey'
    );
    expect(document.documentElement).toHaveClass('storefront-mode-system');
  });

  it('can scope fallback wrapper classes without document-level portal classes', () => {
    const { container } = render(
      <StorefrontThemeProvider scopeDocument={false}>
        <span>fallback</span>
      </StorefrontThemeProvider>
    );
    flushDeferredPortalThemeMode();

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass('storefront-theme-scope');
    expect(wrapper).toHaveClass('storefront-light');
    expect(document.documentElement).toHaveAttribute(
      DOCUMENT_HYDRATION_READY_ATTR,
      'true'
    );
    expect(document.documentElement).not.toHaveClass('storefront-theme-scope');
    expect(document.body).not.toHaveClass('storefront-light');
  });

  it('uses a non-document fallback mount to make the first portal theme pass immediate', () => {
    const fallback = render(
      <StorefrontThemeProvider scopeDocument={false}>
        <span>fallback</span>
      </StorefrontThemeProvider>
    );

    expect(document.documentElement).toHaveAttribute(
      DOCUMENT_HYDRATION_READY_ATTR,
      'true'
    );
    expect(document.documentElement).not.toHaveClass('storefront-theme-scope');

    fallback.unmount();

    render(
      <StorefrontThemeProvider
        appearance={{ mode: 'system', variant: 'ogabassey' }}
      >
        <div>resolved storefront</div>
      </StorefrontThemeProvider>
    );

    expect(document.documentElement).toHaveClass('storefront-theme-scope');
    expect(document.documentElement).toHaveClass(
      'storefront-variant-ogabassey'
    );
    expect(document.documentElement).toHaveClass('storefront-mode-system');
  });

  it('forces light mode for default storefront portal surfaces while mounted', () => {
    const { unmount } = render(
      <StorefrontThemeProvider>
        <div>content</div>
      </StorefrontThemeProvider>
    );
    flushDeferredPortalThemeMode();

    expect(document.documentElement).toHaveClass('storefront-theme-scope');
    expect(document.documentElement).toHaveClass('storefront-variant-default');
    expect(document.documentElement).toHaveClass('light');
    expect(document.documentElement).toHaveClass('storefront-light');
    expect(document.body).toHaveClass('storefront-light');
    expect(
      document.documentElement.getAttribute('data-storefront-light-count')
    ).toBe('1');

    unmount();

    expect(document.documentElement).not.toHaveClass('storefront-theme-scope');
    expect(document.documentElement).not.toHaveClass('storefront-light');
    expect(document.body).not.toHaveClass('storefront-light');
    expect(
      document.documentElement.getAttribute('data-storefront-light-count')
    ).toBeNull();
  });

  it('preserves pre-existing root theme classes when default storefronts unmount', () => {
    document.documentElement.classList.add('light');
    document.body.classList.add('light');

    const { unmount } = render(
      <StorefrontThemeProvider>
        <div>content</div>
      </StorefrontThemeProvider>
    );
    flushDeferredPortalThemeMode();

    expect(document.documentElement).toHaveClass('light');
    expect(document.body).toHaveClass('light');
    expect(
      document.documentElement.getAttribute(
        'data-storefront-light-mode-count-preexisting'
      )
    ).toBe('true');

    unmount();

    expect(document.documentElement).toHaveClass('light');
    expect(document.body).toHaveClass('light');
    expect(document.documentElement).not.toHaveClass('storefront-light');
    expect(document.body).not.toHaveClass('storefront-light');
    expect(
      document.documentElement.getAttribute(
        'data-storefront-light-mode-count-preexisting'
      )
    ).toBeNull();
  });

  it('reference-counts default storefront document classes across multiple mounted providers', () => {
    const first = render(
      <StorefrontThemeProvider>
        <div>first</div>
      </StorefrontThemeProvider>
    );
    const second = render(
      <StorefrontThemeProvider>
        <div>second</div>
      </StorefrontThemeProvider>
    );
    flushDeferredPortalThemeMode();

    expect(document.documentElement).toHaveClass('storefront-light');
    expect(
      document.documentElement.getAttribute('data-storefront-light-count')
    ).toBe('2');
    expect(document.body.getAttribute('data-storefront-light-count')).toBe('2');

    first.unmount();

    expect(document.documentElement).toHaveClass('storefront-light');
    expect(
      document.documentElement.getAttribute('data-storefront-light-count')
    ).toBe('1');
    expect(document.body.getAttribute('data-storefront-light-count')).toBe('1');

    second.unmount();

    expect(document.documentElement).not.toHaveClass('storefront-light');
    expect(
      document.documentElement.getAttribute('data-storefront-light-count')
    ).toBeNull();
    expect(
      document.body.getAttribute('data-storefront-light-count')
    ).toBeNull();
  });

  it('scopes OgaBassey portal surfaces without forced-light document classes', () => {
    const { unmount } = render(
      <StorefrontThemeProvider
        appearance={{ mode: 'system', variant: 'ogabassey' }}
      >
        <div>content</div>
      </StorefrontThemeProvider>
    );
    flushDeferredPortalThemeMode();

    expect(document.documentElement).toHaveClass('storefront-theme-scope');
    expect(document.documentElement).toHaveClass(
      'storefront-variant-ogabassey'
    );
    expect(document.documentElement).toHaveClass('storefront-mode-system');
    expect(document.documentElement).not.toHaveClass('light');
    expect(document.documentElement).not.toHaveClass('storefront-light');
    expect(
      document.documentElement.getAttribute(
        'data-storefront-variant-ogabassey-count'
      )
    ).toBe('1');

    unmount();

    expect(document.documentElement).not.toHaveClass('storefront-theme-scope');
    expect(document.documentElement).not.toHaveClass(
      'storefront-variant-ogabassey'
    );
    expect(document.documentElement).not.toHaveClass('storefront-mode-system');
  });

  it('swaps document-level portal classes synchronously after hydration deferral has run', () => {
    const { rerender } = render(
      <StorefrontThemeProvider>
        <div>content</div>
      </StorefrontThemeProvider>
    );
    flushDeferredPortalThemeMode();

    rerender(
      <StorefrontThemeProvider
        appearance={{ mode: 'system', variant: 'ogabassey' }}
      >
        <div>content</div>
      </StorefrontThemeProvider>
    );

    expect(document.documentElement).toHaveClass(
      'storefront-variant-ogabassey'
    );
    expect(document.documentElement).toHaveClass('storefront-mode-system');
    expect(document.documentElement).not.toHaveClass('storefront-light');
    expect(document.body).toHaveClass('storefront-variant-ogabassey');
    expect(document.body).not.toHaveClass('storefront-light');
  });
});

describe('storefront theme dark-mode CSS contracts', () => {
  it('blocks app-level dark leakage in system-aware scopes while preserving forced-light guards', () => {
    const tailwindConfig = readFileSync(
      join(process.cwd(), 'tailwind.config.mjs'),
      'utf8'
    );
    const globalCss = readFileSync(
      join(process.cwd(), 'src/app/globals.css'),
      'utf8'
    );
    const storefrontGlobalCss = readFileSync(
      join(process.cwd(), 'src/app/(storefront)/storefront-globals.css'),
      'utf8'
    );
    const ogabasseyUtilityCss = readFileSync(
      join(
        process.cwd(),
        'src/app/(storefront)/storefront-ogabassey-dark-mode-utilities.css'
      ),
      'utf8'
    );
    const broadThemeScopeGuard =
      /:not\(\.storefront-theme-scope\):not\(\.storefront-theme-scope \*\)|:not\(\.storefront-theme-scope \*\)/;
    const systemModeSelfGuard = /:not\(\.storefront-mode-system\)/;
    const systemModeDescendantGuard =
      /:not\(\s*\.storefront-mode-system\s+\*\s*\)/;
    const ogabasseyAccentUtility =
      /\.storefront-variant-ogabassey\.storefront-mode-system[\s\S]*\.text-store-primary[\s\S]*color:\s*var\(--storefront-dark-accent\);/;

    expect(tailwindConfig).toContain(':not(.storefront-light *)');
    expect(tailwindConfig).toContain(':not(.storefront-mode-system *)');
    expect(globalCss).toContain(':not(.storefront-light *)');
    expect(globalCss).toMatch(systemModeSelfGuard);
    expect(globalCss).toMatch(systemModeDescendantGuard);
    expect(storefrontGlobalCss).toContain(':not(.storefront-light *)');
    expect(storefrontGlobalCss).toMatch(systemModeSelfGuard);
    expect(storefrontGlobalCss).toMatch(systemModeDescendantGuard);
    expect(ogabasseyUtilityCss).toMatch(ogabasseyAccentUtility);
    expect(tailwindConfig).not.toMatch(broadThemeScopeGuard);
    expect(globalCss).not.toMatch(broadThemeScopeGuard);
    expect(storefrontGlobalCss).not.toMatch(broadThemeScopeGuard);
  });
});
