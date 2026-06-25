# Ogabassey Dark Mode Awareness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `ogabassey.com` dark-mode aware by mirroring the mobile storefront's token-based light/dark approach while preserving SEO, LCP/FCP, CLS, and the current forced-light behavior for other merchants.

**Architecture:** Keep dark mode as a presentation layer: the same HTML, metadata, JSON-LD, headings, links, product copy, and images render in both modes. Add a merchant-scoped storefront appearance resolver, update the current `StorefrontThemeProvider` from a light-only guard into an appearance scope, and drive Ogabassey dark mode through CSS variables and browser `prefers-color-scheme`. Because the Ogabassey shell currently writes several theme variables inline, the dark CSS layer must explicitly override shell-level custom properties in dark/system-dark states while leaving the light fallback intact. Browsers without support fall back to the current light storefront.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, CSS custom properties, `prefers-color-scheme`, `color-scheme`, `caret-color`, Vitest, Testing Library, local/live HTTP probes.

---

## Source Inputs

- Mobile storefront source of truth:
  - `apps/mobile-storefront/constants/themes.ts`
  - `apps/mobile-storefront/components/useColorScheme.ts`
  - `apps/mobile-storefront/stores/settings-store.ts`
  - `apps/mobile-storefront/components/navigation/RootLayoutNav.tsx`
  - `apps/mobile-storefront/constants/themes.test.ts`
- Web storefront current behavior:
  - `apps/web/src/components/storefront/storefront-theme-provider.tsx` forces light mode with `.light` and `.storefront-light`.
  - `apps/web/tailwind.config.mjs` excludes `.light` and `.storefront-light` descendants from raw `dark:` utilities.
  - `apps/web/src/app/(storefront)/[slug]/layout.tsx` wraps all storefronts in `StorefrontThemeProvider`.
  - `apps/web/src/lib/ogabassey-route-identity.ts` recognizes `ogabassey` and `ogabassey.com`.
  - `apps/web/src/components/storefront/ogabassey/storefront-layout-utils.ts` sets shell CSS variables inline through `getOgabasseyLayoutStyle()`.
  - `apps/web/src/components/checkout-theme-provider.tsx` writes checkout brand variables on `documentElement`, so checkout and portal surfaces must be verified separately.
  - `apps/web/src/app/(storefront)/storefront-core.css`, `storefront-foundation.css`, and `storefront-pdp-critical.css` define the critical storefront shell and product-detail surfaces.
- Browser support references:
  - MDN `prefers-color-scheme`: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40media/prefers-color-scheme
  - MDN `color-scheme`: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/color-scheme
  - MDN `caret-color`: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/caret-color
  - MDN `color-mix()`: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/color_value/color-mix
  - Google spam policies for hidden/cloaked content: https://developers.google.com/search/docs/essentials/spam-policies

## Non-Goals

- Do not change product copy, titles, canonicals, JSON-LD, Open Graph tags, Twitter metadata, robots tags, sitemap/feed output, or internal link targets.
- Do not add a custom mouse pointer. Only `caret-color` for text insertion carets is in scope.
- Do not darken, invert, blur, or filter product images.
- Do not make all Baci merchant storefronts dark-mode aware in this branch.
- Do not modify `apps/web/src/proxy.ts`.
- Do not add service-role/admin Supabase behavior.

## Browser Support Contract

This implementation is required to be browser-aware, but browser support is not a blocker when fallbacks are explicit.

- `prefers-color-scheme`: current browsers get system-aware dark mode; unsupported browsers keep the light fallback.
- `color-scheme`: current browsers can adapt form controls, scrollbars, and UA chrome; unsupported browsers keep normal controls.
- `caret-color`: current browsers get themed input carets; unsupported browsers keep the default caret color.
- `color-mix()`: do not introduce a new `color-mix()` declaration without a concrete fallback immediately before it.
- JavaScript is not required for the first paint in `system` mode. CSS media queries must carry the no-flash path.

Every CSS block that uses a progressive feature must be safe when ignored by an older browser.

## File Structure

### Create

| File | Responsibility |
|---|---|
| `apps/web/src/components/storefront/storefront-appearance.ts` | Shared storefront appearance types, class helpers, root/body ref-count helpers, and Ogabassey-only resolver. |
| `apps/web/src/components/storefront/storefront-appearance.test.ts` | Unit tests for Ogabassey-only `system` activation, default forced-light behavior, class helpers, and ref-count cleanup. |
| `apps/web/src/components/storefront/ogabassey/dark-mode-tokens.ts` | Mobile-inspired Ogabassey dark palette constants used by tests and CSS contract checks. |
| `apps/web/src/components/storefront/ogabassey/dark-mode-tokens.test.ts` | WCAG AA contrast tests for dark-mode text, muted text, primary action text, and price/error tokens. |
| `apps/web/src/app/(storefront)/storefront-ogabassey-dark-mode.css` | Merchant-scoped dark/system CSS token layer, caret colors, selection colors, and browser-support fallbacks. |

### Modify

| File | Responsibility |
|---|---|
| `apps/web/src/components/storefront/storefront-theme-provider.tsx` | Accept a scoped appearance descriptor instead of always forcing light mode. |
| `apps/web/src/components/storefront/storefront-theme-provider.test.tsx` | Update and extend tests for light, Ogabassey system, Ogabassey dark, wrapper classes, and portal class ref-counting. |
| `apps/web/src/app/(storefront)/[slug]/layout.tsx` | Resolve appearance from route identifier and pass it to `StorefrontThemeProvider` without moving tenant lookup into the static shell. |
| `apps/web/src/app/(storefront)/[slug]/layout.test.tsx` | Assert Ogabassey receives system appearance and non-Ogabassey storefronts remain light. |
| `apps/web/src/components/storefront/ogabassey/pages/checkout-page.tsx` | Add a stable checkout page scope class so dark overrides can target checkout without rewriting every subcomponent. |
| `apps/web/src/components/storefront/ogabassey/pages/checkout-page.test.tsx` | Assert checkout keeps the dark-mode scope class on normal, loading, and resume-error states. |
| `apps/web/src/app/(storefront)/storefront-core.css` | Import the new dark-mode CSS layer. |
| `apps/web/src/app/(storefront)/storefront-css-partition.test.ts` | Verify the new CSS import, token parity, shell inline-variable overrides, browser fallback discipline, and no custom cursor/image filtering. |
| `apps/web/tailwind.config.mjs` | Exclude the new storefront appearance scope from raw `dark:` variants so CSS variables, not accidental utilities, own storefront dark mode. |
| `apps/web/src/app/globals.css` | Extend hand-authored root `.dark` guard selectors so platform dark styles do not leak into storefront appearance scopes. |
| `apps/web/src/app/(storefront)/storefront-globals.css` | Extend hand-authored storefront `.dark` guard selectors so full storefront CSS remains isolated from root dark mode. |

---

### Task 0: Create an Isolated Worktree

**Files:** none.

- [ ] **Step 1: Create a fresh worktree**

```bash
cd /Users/mac/Baci-app
git fetch origin main
git worktree add /Users/mac/Baci-app/.worktrees/ogabassey-dark-mode-awareness origin/main
cd /Users/mac/Baci-app/.worktrees/ogabassey-dark-mode-awareness
git switch -c codex/ogabassey-dark-mode-awareness
```

Expected:

```text
A clean worktree on branch codex/ogabassey-dark-mode-awareness.
```

- [ ] **Step 2: Verify the current light lock exists**

```bash
rg -n "storefront-light|StorefrontThemeProvider|darkMode" \
  apps/web/src/components/storefront/storefront-theme-provider.tsx \
  apps/web/src/app/\(storefront\)/\[slug\]/layout.tsx \
  apps/web/tailwind.config.mjs
```

Expected:

```text
Matches in StorefrontThemeProvider, storefront layout, and Tailwind darkMode config.
```

- [ ] **Step 3: Commit nothing**

This task is evidence-only.

---

### Task 1: Add Storefront Appearance Helpers

**Files:**
- Create: `apps/web/src/components/storefront/storefront-appearance.ts`
- Create: `apps/web/src/components/storefront/storefront-appearance.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/components/storefront/storefront-appearance.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  decrementStorefrontAppearanceScope,
  getStorefrontAppearanceClassName,
  getStorefrontAppearanceClasses,
  incrementStorefrontAppearanceScope,
  resolveStorefrontAppearance,
} from './storefront-appearance';

describe('resolveStorefrontAppearance', () => {
  it('enables system appearance only for OgaBassey identifiers', () => {
    expect(resolveStorefrontAppearance('ogabassey')).toEqual({
      mode: 'system',
      variant: 'ogabassey',
    });
    expect(resolveStorefrontAppearance('ogabassey.com')).toEqual({
      mode: 'system',
      variant: 'ogabassey',
    });
    expect(resolveStorefrontAppearance('another-merchant')).toEqual({
      mode: 'light',
      variant: 'default',
    });
  });
});

describe('getStorefrontAppearanceClasses', () => {
  it('keeps the existing forced-light classes for default storefronts', () => {
    expect(
      getStorefrontAppearanceClasses({ mode: 'light', variant: 'default' })
    ).toEqual(['storefront-theme-scope', 'light', 'storefront-light']);
  });

  it('adds a merchant-specific system class for OgaBassey', () => {
    expect(
      getStorefrontAppearanceClasses({ mode: 'system', variant: 'ogabassey' })
    ).toEqual([
      'storefront-theme-scope',
      'storefront-mode-system',
      'storefront-variant-ogabassey',
    ]);
  });

  it('returns a stable className string for React effect dependencies', () => {
    expect(
      getStorefrontAppearanceClassName({
        mode: 'system',
        variant: 'ogabassey',
      })
    ).toBe('storefront-theme-scope storefront-mode-system storefront-variant-ogabassey');
  });
});

describe('storefront appearance scope ref-counting', () => {
  it('adds and removes all scoped classes using independent counts', () => {
    const target = document.createElement('div');
    const classes = [
      'storefront-theme-scope',
      'storefront-mode-system',
      'storefront-variant-ogabassey',
    ];

    incrementStorefrontAppearanceScope(target, classes);
    incrementStorefrontAppearanceScope(target, classes);

    expect(target).toHaveClass(...classes);
    expect(
      target.getAttribute('data-storefront-theme-scope-count')
    ).toBe('2');
    expect(
      target.getAttribute('data-storefront-mode-system-count')
    ).toBe('2');

    decrementStorefrontAppearanceScope(target, classes);

    expect(target).toHaveClass(...classes);
    expect(
      target.getAttribute('data-storefront-theme-scope-count')
    ).toBe('1');

    decrementStorefrontAppearanceScope(target, classes);

    for (const className of classes) {
      expect(target).not.toHaveClass(className);
      expect(target.getAttribute(`data-${className}-count`)).toBeNull();
    }
  });
});
```

- [ ] **Step 2: Run the failing tests**

```bash
pnpm --dir apps/web exec vitest run src/components/storefront/storefront-appearance.test.ts
```

Expected:

```text
FAIL src/components/storefront/storefront-appearance.test.ts
Cannot find module './storefront-appearance'
```

- [ ] **Step 3: Implement the helper**

Create `apps/web/src/components/storefront/storefront-appearance.ts`:

```ts
import { getKnownOgaBasseyMerchantId } from '@/lib/ogabassey-route-identity';

export type StorefrontAppearanceMode = 'light' | 'dark' | 'system';
export type StorefrontAppearanceVariant = 'default' | 'ogabassey';

export interface StorefrontAppearance {
  mode: StorefrontAppearanceMode;
  variant: StorefrontAppearanceVariant;
}

const STOREFRONT_THEME_SCOPE_CLASS = 'storefront-theme-scope';
const LEGACY_LIGHT_CLASS = 'light';
const STOREFRONT_LIGHT_CLASS = 'storefront-light';
const STOREFRONT_MODE_PREFIX = 'storefront-mode-';
const STOREFRONT_VARIANT_PREFIX = 'storefront-variant-';

function countAttrForClass(className: string) {
  return `data-${className}-count`;
}

export function resolveStorefrontAppearance(
  storefrontIdentifier: string
): StorefrontAppearance {
  if (getKnownOgaBasseyMerchantId(storefrontIdentifier)) {
    return { mode: 'system', variant: 'ogabassey' };
  }

  return { mode: 'light', variant: 'default' };
}

export function getStorefrontAppearanceClasses(
  appearance: StorefrontAppearance
): string[] {
  if (appearance.mode === 'light' && appearance.variant === 'default') {
    return [
      STOREFRONT_THEME_SCOPE_CLASS,
      LEGACY_LIGHT_CLASS,
      STOREFRONT_LIGHT_CLASS,
    ];
  }

  return [
    STOREFRONT_THEME_SCOPE_CLASS,
    `${STOREFRONT_MODE_PREFIX}${appearance.mode}`,
    `${STOREFRONT_VARIANT_PREFIX}${appearance.variant}`,
  ];
}

export function getStorefrontAppearanceClassName(
  appearance: StorefrontAppearance
): string {
  return getStorefrontAppearanceClasses(appearance).join(' ');
}

export function incrementStorefrontAppearanceScope(
  target: HTMLElement,
  classes: readonly string[]
) {
  for (const className of classes) {
    const attr = countAttrForClass(className);
    const current = Number.parseInt(target.getAttribute(attr) ?? '0', 10);
    const next = Number.isFinite(current) ? current + 1 : 1;

    target.setAttribute(attr, String(next));
    target.classList.add(className);
  }
}

export function decrementStorefrontAppearanceScope(
  target: HTMLElement,
  classes: readonly string[]
) {
  for (const className of classes) {
    const attr = countAttrForClass(className);
    const current = Number.parseInt(target.getAttribute(attr) ?? '0', 10);
    const next = Number.isFinite(current) ? current - 1 : 0;

    if (next > 0) {
      target.setAttribute(attr, String(next));
      continue;
    }

    target.removeAttribute(attr);
    target.classList.remove(className);
  }
}
```

- [ ] **Step 4: Run the tests**

```bash
pnpm --dir apps/web exec vitest run src/components/storefront/storefront-appearance.test.ts
```

Expected:

```text
PASS src/components/storefront/storefront-appearance.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/storefront/storefront-appearance.ts \
  apps/web/src/components/storefront/storefront-appearance.test.ts
git commit -m "feat: add storefront appearance resolver"
```

---

### Task 2: Refactor StorefrontThemeProvider

**Files:**
- Modify: `apps/web/src/components/storefront/storefront-theme-provider.tsx`
- Modify: `apps/web/src/components/storefront/storefront-theme-provider.test.tsx`

- [ ] **Step 1: Replace the provider tests**

Update `apps/web/src/components/storefront/storefront-theme-provider.test.tsx` so it covers default light behavior plus Ogabassey system mode:

```ts
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { StorefrontThemeProvider } from './storefront-theme-provider';

const trackedClasses = [
  'storefront-theme-scope',
  'light',
  'storefront-light',
  'storefront-mode-system',
  'storefront-mode-dark',
  'storefront-variant-ogabassey',
] as const;

function resetClasses(target: HTMLElement) {
  for (const className of trackedClasses) {
    target.classList.remove(className);
    target.removeAttribute(`data-${className}-count`);
  }
}

describe('StorefrontThemeProvider', () => {
  beforeEach(() => {
    resetClasses(document.documentElement);
    resetClasses(document.body);
  });

  afterEach(() => {
    resetClasses(document.documentElement);
    resetClasses(document.body);
  });

  it('renders children inside the storefront theme scope', () => {
    render(
      <StorefrontThemeProvider>
        <main>Storefront content</main>
      </StorefrontThemeProvider>
    );

    expect(screen.getByRole('main')).toHaveTextContent('Storefront content');
  });

  it('preserves default forced-light wrapper classes', () => {
    const { container } = render(
      <StorefrontThemeProvider>
        <span>child</span>
      </StorefrontThemeProvider>
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass(
      'storefront-theme-scope',
      'light',
      'storefront-light'
    );
    expect(document.documentElement).toHaveClass(
      'storefront-theme-scope',
      'light',
      'storefront-light'
    );
    expect(document.body).toHaveClass(
      'storefront-theme-scope',
      'light',
      'storefront-light'
    );
  });

  it('applies OgaBassey system classes without the light lock', () => {
    const { container } = render(
      <StorefrontThemeProvider
        appearance={{ mode: 'system', variant: 'ogabassey' }}
      >
        <span>child</span>
      </StorefrontThemeProvider>
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass(
      'storefront-theme-scope',
      'storefront-mode-system',
      'storefront-variant-ogabassey'
    );
    expect(wrapper).not.toHaveClass('light');
    expect(wrapper).not.toHaveClass('storefront-light');
    expect(document.documentElement).toHaveClass('storefront-mode-system');
    expect(document.body).toHaveClass('storefront-variant-ogabassey');
  });

  it('reference-counts portal appearance classes across multiple mounted providers', () => {
    const first = render(
      <StorefrontThemeProvider
        appearance={{ mode: 'system', variant: 'ogabassey' }}
      >
        <div>first</div>
      </StorefrontThemeProvider>
    );
    const second = render(
      <StorefrontThemeProvider
        appearance={{ mode: 'system', variant: 'ogabassey' }}
      >
        <div>second</div>
      </StorefrontThemeProvider>
    );

    expect(
      document.documentElement.getAttribute(
        'data-storefront-mode-system-count'
      )
    ).toBe('2');

    first.unmount();

    expect(document.documentElement).toHaveClass('storefront-mode-system');
    expect(
      document.documentElement.getAttribute(
        'data-storefront-mode-system-count'
      )
    ).toBe('1');

    second.unmount();

    expect(document.documentElement).not.toHaveClass('storefront-mode-system');
    expect(
      document.documentElement.getAttribute(
        'data-storefront-mode-system-count'
      )
    ).toBeNull();
  });

  it('does not churn portal class counts when an equivalent appearance rerenders', () => {
    const { rerender } = render(
      <StorefrontThemeProvider
        appearance={{ mode: 'system', variant: 'ogabassey' }}
      >
        <div>first</div>
      </StorefrontThemeProvider>
    );

    expect(
      document.documentElement.getAttribute(
        'data-storefront-mode-system-count'
      )
    ).toBe('1');

    rerender(
      <StorefrontThemeProvider
        appearance={{ mode: 'system', variant: 'ogabassey' }}
      >
        <div>second</div>
      </StorefrontThemeProvider>
    );

    expect(
      document.documentElement.getAttribute(
        'data-storefront-mode-system-count'
      )
    ).toBe('1');
  });
});
```

- [ ] **Step 2: Run the failing tests**

```bash
pnpm --dir apps/web exec vitest run src/components/storefront/storefront-theme-provider.test.tsx
```

Expected:

```text
FAIL src/components/storefront/storefront-theme-provider.test.tsx
```

- [ ] **Step 3: Update the provider**

Replace `apps/web/src/components/storefront/storefront-theme-provider.tsx` with:

```tsx
'use client';

import { type ReactNode, useLayoutEffect } from 'react';
import {
  decrementStorefrontAppearanceScope,
  getStorefrontAppearanceClassName,
  getStorefrontAppearanceClasses,
  incrementStorefrontAppearanceScope,
  type StorefrontAppearance,
} from './storefront-appearance';

interface StorefrontThemeProviderProps {
  appearance?: StorefrontAppearance;
  children: ReactNode;
}

const DEFAULT_STOREFRONT_APPEARANCE: StorefrontAppearance = {
  mode: 'light',
  variant: 'default',
};

/**
 * Scopes storefront appearance so public merchant pages are isolated from the
 * root dashboard/admin theme. Default behavior remains forced light; OgaBassey
 * can opt into system-aware tokens without changing other merchants.
 */
export function StorefrontThemeProvider({
  appearance = DEFAULT_STOREFRONT_APPEARANCE,
  children,
}: StorefrontThemeProviderProps) {
  const { mode, variant } = appearance;
  const className = getStorefrontAppearanceClassName({ mode, variant });

  useLayoutEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const classes = getStorefrontAppearanceClasses({ mode, variant });

    incrementStorefrontAppearanceScope(root, classes);
    incrementStorefrontAppearanceScope(body, classes);

    return () => {
      decrementStorefrontAppearanceScope(root, classes);
      decrementStorefrontAppearanceScope(body, classes);
    };
  }, [mode, variant]);

  return <div className={`${className} contents`}>{children}</div>;
}
```

- [ ] **Step 4: Run the tests**

```bash
pnpm --dir apps/web exec vitest run src/components/storefront/storefront-theme-provider.test.tsx src/components/storefront/storefront-appearance.test.ts
```

Expected:

```text
PASS src/components/storefront/storefront-theme-provider.test.tsx
PASS src/components/storefront/storefront-appearance.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/storefront/storefront-theme-provider.tsx \
  apps/web/src/components/storefront/storefront-theme-provider.test.tsx
git commit -m "feat: scope storefront appearance provider"
```

---

### Task 3: Wire OgaBassey Appearance in Storefront Layout

**Files:**
- Modify: `apps/web/src/app/(storefront)/[slug]/layout.tsx`
- Modify: `apps/web/src/app/(storefront)/[slug]/layout.test.tsx`

- [ ] **Step 1: Update the layout tests**

In `apps/web/src/app/(storefront)/[slug]/layout.test.tsx`, extend the `StorefrontThemeProvider` mock so it captures the `appearance` prop:

```ts
const mockStorefrontThemeProvider = vi.hoisted(() =>
  vi.fn(
    ({
      children,
      appearance,
    }: {
      appearance?: { mode: string; variant: string };
      children: ReactNode;
    }) => {
      themeProviderRenders += 1;

      return (
        <div
          data-appearance-mode={appearance?.mode ?? 'light'}
          data-appearance-variant={appearance?.variant ?? 'default'}
          data-testid="storefront-theme-provider"
        >
          {children}
        </div>
      );
    }
  )
);

vi.mock('@/components/storefront/storefront-theme-provider', () => ({
  StorefrontThemeProvider: mockStorefrontThemeProvider,
}));
```

Update the existing `renders the static PPR shell by default while tenant data is loading` render block so the test handles the new async default layout entrypoint without placing an async component inside the client-rendered JSX tree:

```tsx
const ui = await StorefrontLayout({
  children: <main>Storefront content</main>,
  params: Promise.resolve({ slug: 'ogabassey' }),
});

await act(() => {
  ({ container, unmount } = render(ui));
});
```

Update the existing `keeps explicit layout loading fallbacks overridable` render block the same way:

```tsx
const ui = await StorefrontLayout({
  children: <main>Storefront content</main>,
  loadingFallback: fallback,
  params: Promise.resolve({ slug: 'ogabassey' }),
});

await act(() => {
  ({ unmount } = render(ui));
});
```

Add these assertions to the same test file:

```ts
it('passes system appearance for the OgaBassey storefront shell', async () => {
  const deferredSnapshotBase =
    createDeferred<typeof baseShellSnapshotWithoutCategories>();
  vi.mocked(getStorefrontShellSnapshotBase).mockReturnValue(
    deferredSnapshotBase.promise
  );

  const ui = await StorefrontLayout({
    children: <main>storefront</main>,
    params: Promise.resolve({ slug: 'ogabassey' }),
  });

  await act(() => {
    render(ui);
  });

  expect(screen.getByTestId('storefront-theme-provider')).toHaveAttribute(
    'data-appearance-mode',
    'system'
  );
  expect(screen.getByTestId('storefront-theme-provider')).toHaveAttribute(
    'data-appearance-variant',
    'ogabassey'
  );
});

it('keeps non-OgaBassey storefronts in forced light mode', async () => {
  const deferredSnapshotBase =
    createDeferred<typeof baseShellSnapshotWithoutCategories>();
  vi.mocked(getStorefrontShellSnapshotBase).mockReturnValue(
    deferredSnapshotBase.promise
  );

  const ui = await StorefrontLayout({
    children: <main>storefront</main>,
    params: Promise.resolve({ slug: 'another-store' }),
  });

  await act(() => {
    render(ui);
  });

  expect(screen.getByTestId('storefront-theme-provider')).toHaveAttribute(
    'data-appearance-mode',
    'light'
  );
  expect(screen.getByTestId('storefront-theme-provider')).toHaveAttribute(
    'data-appearance-variant',
    'default'
  );
});
```

- [ ] **Step 2: Run the failing layout test**

```bash
pnpm --dir apps/web exec vitest run 'src/app/(storefront)/[slug]/layout.test.tsx'
```

Expected:

```text
FAIL src/app/(storefront)/[slug]/layout.test.tsx
```

- [ ] **Step 3: Pass appearance through the layout**

In `apps/web/src/app/(storefront)/[slug]/layout.tsx`, import the resolver:

```ts
import {
  resolveStorefrontAppearance,
  type StorefrontAppearance,
} from '@/components/storefront/storefront-appearance';
```

Keep `StorefrontThemeFrame` synchronous. This avoids rendering an async component directly in the client-side layout tests and keeps the PPR static shell structure predictable:

```tsx
function StorefrontThemeFrame({
  appearance,
  children,
}: {
  appearance: StorefrontAppearance;
  children: React.ReactNode;
}) {
  return (
    <StorefrontThemeProvider appearance={appearance}>
      {children}
    </StorefrontThemeProvider>
  );
}
```

Change the default layout to be the only place that awaits `params` for appearance. `StorefrontLayoutContent` still receives a resolved params promise so the existing tenant data lookup remains inside the PPR dynamic content slot:

```tsx
export default async function StorefrontLayout(props: {
  children: React.ReactNode;
  loadingFallback?: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  // Keep the request-bound tenant lookup out of the prerendered root HTML.
  // Next 16.2/PPR can resume Googlebot's blocking metadata boundary into the
  // dynamic Suspense slot when that slot owns a visible fallback. Preserve the
  // human PPR shell as a static sibling instead: browsers get immediate chrome
  // and LCP imagery, while the resume slot itself stays null for bot/blocking
  // metadata requests.
  const { slug } = await props.params;
  const { loadingFallback, ...contentProps } = props;
  // Undefined uses the shared ShellChromeLoading; explicit null opts out for
  // routes that intentionally need no static visual shell.
  const staticLoadingFallback =
    loadingFallback === undefined ? <ShellChromeLoading /> : loadingFallback;
  const appearance = resolveStorefrontAppearance(slug);
  const resolvedContentProps = {
    ...contentProps,
    params: Promise.resolve({ slug }),
  };

  return (
    <StorefrontThemeFrame appearance={appearance}>
      <StorefrontPprStaticShell loadingFallback={staticLoadingFallback}>
        <StorefrontLayoutContent {...resolvedContentProps} />
      </StorefrontPprStaticShell>
    </StorefrontThemeFrame>
  );
}
```

Do not use this rejected shape:

```tsx
return (
  <StorefrontThemeFrame params={props.params}>
    <StorefrontPprStaticShell loadingFallback={staticLoadingFallback}>
      <StorefrontLayoutContent {...contentProps} />
    </StorefrontPprStaticShell>
  </StorefrontThemeFrame>
);
```

The rejected version makes `StorefrontThemeFrame` async and leaves existing `StorefrontLayout` tests vulnerable to rendering an unresolved async component outside the current test pattern.

- [ ] **Step 4: Run the focused tests**

```bash
pnpm --dir apps/web exec vitest run \
  'src/app/(storefront)/[slug]/layout.test.tsx' \
  src/components/storefront/storefront-appearance.test.ts \
  src/components/storefront/storefront-theme-provider.test.tsx
```

Expected:

```text
PASS src/app/(storefront)/[slug]/layout.test.tsx
PASS src/components/storefront/storefront-appearance.test.ts
PASS src/components/storefront/storefront-theme-provider.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add 'apps/web/src/app/(storefront)/[slug]/layout.tsx' \
  'apps/web/src/app/(storefront)/[slug]/layout.test.tsx'
git commit -m "feat: enable system appearance for OgaBassey storefront"
```

---

### Task 4: Add Ogabassey Dark Tokens and Contrast Tests

**Files:**
- Create: `apps/web/src/components/storefront/ogabassey/dark-mode-tokens.ts`
- Create: `apps/web/src/components/storefront/ogabassey/dark-mode-tokens.test.ts`

- [ ] **Step 1: Write the failing contrast tests**

Create `apps/web/src/components/storefront/ogabassey/dark-mode-tokens.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { getContrastRatio } from '@/lib/color-utils';
import { OGABASSEY_DARK_TOKENS } from './dark-mode-tokens';

function expectAaContrast(
  tokenName: string,
  foreground: string,
  background: string
) {
  const ratio = getContrastRatio(foreground, background);

  expect(ratio, `${tokenName} contrast`).toBeGreaterThanOrEqual(4.5);
}

function expectLargeContrast(
  tokenName: string,
  foreground: string,
  background: string
) {
  const ratio = getContrastRatio(foreground, background);

  expect(ratio, `${tokenName} large contrast`).toBeGreaterThanOrEqual(3);
}

describe('OGABASSEY_DARK_TOKENS', () => {
  it('keeps core dark text readable on background and cards', () => {
    expectAaContrast(
      'foreground on background',
      OGABASSEY_DARK_TOKENS.foreground,
      OGABASSEY_DARK_TOKENS.background
    );
    expectAaContrast(
      'muted foreground on background',
      OGABASSEY_DARK_TOKENS.mutedForeground,
      OGABASSEY_DARK_TOKENS.background
    );
    expectAaContrast(
      'card foreground on card',
      OGABASSEY_DARK_TOKENS.cardForeground,
      OGABASSEY_DARK_TOKENS.card
    );
  });

  it('keeps action and commerce tokens readable', () => {
    expectAaContrast(
      'primary foreground on primary',
      OGABASSEY_DARK_TOKENS.primaryForeground,
      OGABASSEY_DARK_TOKENS.primary
    );
    expectLargeContrast(
      'price on background',
      OGABASSEY_DARK_TOKENS.price,
      OGABASSEY_DARK_TOKENS.background
    );
    expectLargeContrast(
      'error on background',
      OGABASSEY_DARK_TOKENS.error,
      OGABASSEY_DARK_TOKENS.background
    );
  });
});
```

- [ ] **Step 2: Run the failing tests**

```bash
pnpm --dir apps/web exec vitest run src/components/storefront/ogabassey/dark-mode-tokens.test.ts
```

Expected:

```text
FAIL src/components/storefront/ogabassey/dark-mode-tokens.test.ts
Cannot find module './dark-mode-tokens'
```

- [ ] **Step 3: Add mobile-inspired web tokens**

Create `apps/web/src/components/storefront/ogabassey/dark-mode-tokens.ts`:

```ts
export const OGABASSEY_DARK_TOKENS = {
  background: '#0A0A0A',
  foreground: '#F9FAFB',
  card: '#1A1A1A',
  cardForeground: '#F9FAFB',
  muted: '#262626',
  mutedForeground: '#D1D5DB',
  border: '#1F2937',
  primary: '#F59E0B',
  primaryForeground: '#000000',
  secondary: '#DC2626',
  secondaryForeground: '#FFFFFF',
  accent: '#F59E0B',
  accentForeground: '#000000',
  price: '#F87171',
  rating: '#FBBF24',
  error: '#F87171',
  success: '#34D399',
  warning: '#FBBF24',
} as const;
```

- [ ] **Step 4: Run the tests**

```bash
pnpm --dir apps/web exec vitest run src/components/storefront/ogabassey/dark-mode-tokens.test.ts
```

Expected:

```text
PASS src/components/storefront/ogabassey/dark-mode-tokens.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/storefront/ogabassey/dark-mode-tokens.ts \
  apps/web/src/components/storefront/ogabassey/dark-mode-tokens.test.ts
git commit -m "test: lock OgaBassey dark token contrast"
```

---

### Task 5: Add the CSS Dark Mode Layer

**Files:**
- Create: `apps/web/src/app/(storefront)/storefront-ogabassey-dark-mode.css`
- Modify: `apps/web/src/app/(storefront)/storefront-core.css`
- Modify: `apps/web/src/app/(storefront)/storefront-css-partition.test.ts`

- [ ] **Step 1: Add failing CSS contract tests**

Add this import to `apps/web/src/app/(storefront)/storefront-css-partition.test.ts`:

```ts
import { OGABASSEY_DARK_TOKENS } from '@/components/storefront/ogabassey/dark-mode-tokens';
```

Add these cases to the same test file:

```ts
it('loads the OgaBassey dark-mode token layer from storefront core', () => {
  const coreCss = readStorefrontFile('storefront-core.css');

  expect(coreCss).toMatch(
    /@import\s+['"]\.\/storefront-ogabassey-dark-mode\.css['"];?/
  );
});

it('keeps the CSS dark token literals aligned with the TS token contract', () => {
  const darkModeCss = readStorefrontFile(
    'storefront-ogabassey-dark-mode.css'
  ).toLowerCase();
  const expectedTokens = [
    ['--storefront-dark-background', OGABASSEY_DARK_TOKENS.background],
    ['--storefront-dark-foreground', OGABASSEY_DARK_TOKENS.foreground],
    ['--storefront-dark-card', OGABASSEY_DARK_TOKENS.card],
    ['--storefront-dark-card-foreground', OGABASSEY_DARK_TOKENS.cardForeground],
    ['--storefront-dark-muted', OGABASSEY_DARK_TOKENS.muted],
    [
      '--storefront-dark-muted-foreground',
      OGABASSEY_DARK_TOKENS.mutedForeground,
    ],
    ['--storefront-dark-border', OGABASSEY_DARK_TOKENS.border],
    ['--storefront-dark-primary', OGABASSEY_DARK_TOKENS.primary],
    [
      '--storefront-dark-primary-foreground',
      OGABASSEY_DARK_TOKENS.primaryForeground,
    ],
    ['--storefront-dark-secondary', OGABASSEY_DARK_TOKENS.secondary],
    [
      '--storefront-dark-secondary-foreground',
      OGABASSEY_DARK_TOKENS.secondaryForeground,
    ],
    ['--storefront-dark-accent', OGABASSEY_DARK_TOKENS.accent],
    [
      '--storefront-dark-accent-foreground',
      OGABASSEY_DARK_TOKENS.accentForeground,
    ],
    ['--storefront-dark-price', OGABASSEY_DARK_TOKENS.price],
    ['--storefront-dark-rating', OGABASSEY_DARK_TOKENS.rating],
    ['--storefront-dark-success', OGABASSEY_DARK_TOKENS.success],
    ['--storefront-dark-warning', OGABASSEY_DARK_TOKENS.warning],
    ['--storefront-dark-error', OGABASSEY_DARK_TOKENS.error],
  ] as const;

  for (const [cssVariable, token] of expectedTokens) {
    expect(darkModeCss).toContain(`${cssVariable}: ${token.toLowerCase()};`);
  }
});

it('keeps the OgaBassey dark-mode layer browser-safe and cosmetic-only', () => {
  const darkModeCss = readStorefrontFile('storefront-ogabassey-dark-mode.css');

  expect(darkModeCss).toContain('@media (prefers-color-scheme: dark)');
  expect(darkModeCss).toContain('color-scheme: dark');
  expect(darkModeCss).toContain('caret-color: var(--store-accent');
  expect(darkModeCss).toContain(
    '.storefront-variant-ogabassey.storefront-mode-dark .ogabassey-storefront-shell'
  );
  expect(darkModeCss).toContain('--background: 0 0% 4% !important;');
  expect(darkModeCss).toContain(
    '--store-primary: var(--storefront-dark-primary) !important;'
  );
  expect(darkModeCss).toContain('background-color: #1a1a1a;');
  expect(darkModeCss).toContain('@supports (background-color: color-mix(');
  expect(darkModeCss).toContain('background-color: color-mix(');
  expect(darkModeCss).not.toMatch(/cursor\s*:\s*url\(/);
  expect(darkModeCss).not.toMatch(/cursor\s*:\s*none/);
  expect(darkModeCss).not.toMatch(/filter\s*:\s*(invert|brightness|grayscale)/);
});
```

- [ ] **Step 2: Run the failing CSS tests**

```bash
pnpm --dir apps/web exec vitest run 'src/app/(storefront)/storefront-css-partition.test.ts'
```

Expected:

```text
FAIL src/app/(storefront)/storefront-css-partition.test.ts
Missing storefront fixture storefront-ogabassey-dark-mode.css
```

- [ ] **Step 3: Import the CSS layer**

Add this import as the first statement in `apps/web/src/app/(storefront)/storefront-core.css`, directly before the existing `@theme inline` block:

```css
@import "./storefront-ogabassey-dark-mode.css";
```

- [ ] **Step 4: Create the CSS layer**

Create `apps/web/src/app/(storefront)/storefront-ogabassey-dark-mode.css`:

The `.ogabassey-storefront-shell` custom-property overrides intentionally use `!important` because the current shell sets several theme variables inline through `getOgabasseyLayoutStyle()`. Do not use `!important` outside these shell variable overrides in this task.

```css
@layer base {
  .storefront-variant-ogabassey.storefront-mode-dark,
  .storefront-variant-ogabassey.storefront-mode-system {
    color-scheme: light dark;
  }

  .storefront-variant-ogabassey.storefront-mode-dark {
    color-scheme: dark;
  }

  .storefront-variant-ogabassey.storefront-mode-dark,
  .storefront-variant-ogabassey.storefront-mode-system {
    --storefront-dark-background: #0a0a0a;
    --storefront-dark-foreground: #f9fafb;
    --storefront-dark-card: #1a1a1a;
    --storefront-dark-card-foreground: #f9fafb;
    --storefront-dark-muted: #262626;
    --storefront-dark-muted-foreground: #d1d5db;
    --storefront-dark-border: #1f2937;
    --storefront-dark-primary: #f59e0b;
    --storefront-dark-primary-foreground: #000000;
    --storefront-dark-secondary: #dc2626;
    --storefront-dark-secondary-foreground: #ffffff;
    --storefront-dark-accent: #f59e0b;
    --storefront-dark-accent-foreground: #000000;
    --storefront-dark-price: #f87171;
    --storefront-dark-rating: #fbbf24;
    --storefront-dark-success: #34d399;
    --storefront-dark-warning: #fbbf24;
    --storefront-dark-error: #f87171;
  }

  .storefront-variant-ogabassey.storefront-mode-dark {
    --store-background: var(--storefront-dark-background);
    --store-background-text: var(--storefront-dark-foreground);
    --store-foreground: var(--storefront-dark-foreground);
    --store-surface: var(--storefront-dark-card);
    --store-border: var(--storefront-dark-border);
    --store-primary: var(--storefront-dark-primary);
    --store-primary-text: var(--storefront-dark-primary-foreground);
    --store-on-primary: var(--storefront-dark-primary-foreground);
    --store-secondary: var(--storefront-dark-muted);
    --store-secondary-text: var(--storefront-dark-muted-foreground);
    --store-accent: var(--storefront-dark-accent);
    --store-accent-text: var(--storefront-dark-accent-foreground);
    --store-option-secondary: var(--storefront-dark-muted);
    --store-rating: var(--storefront-dark-rating);
  }

  .storefront-variant-ogabassey.storefront-mode-dark
    .ogabassey-storefront-shell {
    --background: 0 0% 4% !important;
    --foreground: 210 20% 98% !important;
    --card: 0 0% 10% !important;
    --card-foreground: 210 20% 98% !important;
    --primary: 37 92% 50% !important;
    --primary-foreground: 0 0% 0% !important;
    --accent: 37 92% 50% !important;
    --accent-foreground: 0 0% 0% !important;
    --ring: 37 92% 50% !important;
    --store-primary: var(--storefront-dark-primary) !important;
    --store-primary-text: var(--storefront-dark-primary-foreground) !important;
    --store-on-primary: var(--storefront-dark-primary-foreground) !important;
    --store-border: var(--storefront-dark-border) !important;
    --store-accent: var(--storefront-dark-accent) !important;
  }

  @media (prefers-color-scheme: dark) {
    .storefront-variant-ogabassey.storefront-mode-system {
      color-scheme: dark;
      --store-background: var(--storefront-dark-background);
      --store-background-text: var(--storefront-dark-foreground);
      --store-foreground: var(--storefront-dark-foreground);
      --store-surface: var(--storefront-dark-card);
      --store-border: var(--storefront-dark-border);
      --store-primary: var(--storefront-dark-primary);
      --store-primary-text: var(--storefront-dark-primary-foreground);
      --store-on-primary: var(--storefront-dark-primary-foreground);
      --store-secondary: var(--storefront-dark-muted);
      --store-secondary-text: var(--storefront-dark-muted-foreground);
      --store-accent: var(--storefront-dark-accent);
      --store-accent-text: var(--storefront-dark-accent-foreground);
      --store-option-secondary: var(--storefront-dark-muted);
      --store-rating: var(--storefront-dark-rating);
    }

    .storefront-variant-ogabassey.storefront-mode-system
      .ogabassey-storefront-shell {
      --background: 0 0% 4% !important;
      --foreground: 210 20% 98% !important;
      --card: 0 0% 10% !important;
      --card-foreground: 210 20% 98% !important;
      --primary: 37 92% 50% !important;
      --primary-foreground: 0 0% 0% !important;
      --accent: 37 92% 50% !important;
      --accent-foreground: 0 0% 0% !important;
      --ring: 37 92% 50% !important;
      --store-primary: var(--storefront-dark-primary) !important;
      --store-primary-text: var(--storefront-dark-primary-foreground) !important;
      --store-on-primary: var(--storefront-dark-primary-foreground) !important;
      --store-border: var(--storefront-dark-border) !important;
      --store-accent: var(--storefront-dark-accent) !important;
    }
  }

  .storefront-variant-ogabassey input,
  .storefront-variant-ogabassey textarea,
  .storefront-variant-ogabassey [contenteditable="true"] {
    caret-color: var(--store-primary, #dc2626);
  }

  .storefront-variant-ogabassey.storefront-mode-dark input,
  .storefront-variant-ogabassey.storefront-mode-dark textarea,
  .storefront-variant-ogabassey.storefront-mode-dark [contenteditable="true"] {
    caret-color: var(--store-accent, #f59e0b);
  }

  @media (prefers-color-scheme: dark) {
    .storefront-variant-ogabassey.storefront-mode-system input,
    .storefront-variant-ogabassey.storefront-mode-system textarea,
    .storefront-variant-ogabassey.storefront-mode-system
      [contenteditable="true"] {
      caret-color: var(--store-accent, #f59e0b);
    }
  }

  .storefront-variant-ogabassey.storefront-mode-dark ::selection {
    background-color: #1a1a1a;
    color: var(--store-background-text, #f9fafb);
  }

  @supports (background-color: color-mix(in srgb, white 50%, transparent)) {
    .storefront-variant-ogabassey.storefront-mode-dark ::selection {
      background-color: color-mix(
        in srgb,
        var(--store-accent, #f59e0b) 34%,
        #1a1a1a
      );
    }
  }

  @media (prefers-color-scheme: dark) {
    .storefront-variant-ogabassey.storefront-mode-system ::selection {
      background-color: #1a1a1a;
      color: var(--store-background-text, #f9fafb);
    }

    @supports (background-color: color-mix(in srgb, white 50%, transparent)) {
      .storefront-variant-ogabassey.storefront-mode-system ::selection {
        background-color: color-mix(
          in srgb,
          var(--store-accent, #f59e0b) 34%,
          #1a1a1a
        );
      }
    }
  }
}
```

- [ ] **Step 5: Run CSS and token tests**

```bash
pnpm --dir apps/web exec vitest run \
  'src/app/(storefront)/storefront-css-partition.test.ts' \
  src/components/storefront/ogabassey/dark-mode-tokens.test.ts
```

Expected:

```text
PASS src/app/(storefront)/storefront-css-partition.test.ts
PASS src/components/storefront/ogabassey/dark-mode-tokens.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add 'apps/web/src/app/(storefront)/storefront-ogabassey-dark-mode.css' \
  'apps/web/src/app/(storefront)/storefront-core.css' \
  'apps/web/src/app/(storefront)/storefront-css-partition.test.ts'
git commit -m "feat: add OgaBassey dark storefront tokens"
```

---

### Task 5A: Add OgaBassey Dark Surface Overrides for Hardcoded Utilities

**Files:**
- Modify: `apps/web/src/components/storefront/ogabassey/pages/checkout-page.tsx`
- Modify: `apps/web/src/components/storefront/ogabassey/pages/checkout-page.test.tsx`
- Modify: `apps/web/src/app/(storefront)/storefront-ogabassey-dark-mode.css`
- Modify: `apps/web/src/app/(storefront)/storefront-css-partition.test.ts`

- [ ] **Step 1: Add failing checkout-scope tests**

In `apps/web/src/components/storefront/ogabassey/pages/checkout-page.test.tsx`, add assertions that the rendered checkout root has a stable class. Use the existing `mockCheckoutSubmissionState()`, `vi.mocked(useSearchParams)`, and `vi.spyOn(globalThis, 'fetch')` patterns from that file:

```ts
it('wraps the normal checkout state in the OgaBassey checkout scope', async () => {
  mockCheckoutSubmissionState();

  render(<CheckoutPage />);

  const checkoutMarkers = await screen.findAllByText(/secure checkout/i);

  expect(
    checkoutMarkers.some((node) => node.closest('.ogabassey-checkout-page'))
  ).toBe(true);
});

it('wraps the checkout loading state in the OgaBassey checkout scope', async () => {
  vi.mocked(useSearchParams).mockReturnValue(
    new URLSearchParams({
      gateway: 'credpal',
      orderId: 'ord-1',
      trackingToken: 'tok-123',
    }) as unknown as ReturnType<typeof useSearchParams>
  );
  const fetchMock = vi
    .spyOn(globalThis, 'fetch')
    .mockReturnValue(new Promise<Response>(() => undefined));

  try {
    render(<CheckoutPage />);

    const loadingRoot = await screen
      .findByText(/loading order/i)
      .then((node) => node.closest('.ogabassey-checkout-page'));

    expect(loadingRoot).toBeInTheDocument();
  } finally {
    fetchMock.mockRestore();
  }
});

it('wraps the resume-error state in the OgaBassey checkout scope', async () => {
  vi.mocked(useSearchParams).mockReturnValue(
    new URLSearchParams({
      gateway: 'credpal',
      orderId: 'ord-1',
      trackingToken: 'tok-123',
    }) as unknown as ReturnType<typeof useSearchParams>
  );
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: false,
    json: async () => ({}),
  } as Response);

  try {
    render(<CheckoutPage />);

    const errorRoot = await screen
      .findByText(/something went wrong/i)
      .then((node) => node.closest('.ogabassey-checkout-page'));

    expect(errorRoot).toBeInTheDocument();
  } finally {
    fetchMock.mockRestore();
  }
});
```

- [ ] **Step 2: Add failing CSS contract coverage**

In `apps/web/src/app/(storefront)/storefront-css-partition.test.ts`, normalize CSS whitespace before checking formatter-wrapped selectors:

```ts
const normalizedDarkModeCss = darkModeCss.replace(/\s+/g, ' ');

expect(normalizedDarkModeCss).toContain(
  '.storefront-variant-ogabassey.storefront-mode-dark .ogabassey-storefront-shell :is(.bg-white'
);
expect(darkModeCss).toContain('.ogabassey-checkout-page');
expect(normalizedDarkModeCss).toContain(
  '.storefront-variant-ogabassey.storefront-mode-dark .ogabassey-checkout-page'
);
expect(normalizedDarkModeCss).toContain(
  '.storefront-variant-ogabassey.storefront-mode-system .ogabassey-checkout-page'
);
expect(darkModeCss).toContain('background-color: #1a1a1a;');
expect(darkModeCss).toContain('@supports (background-color: color-mix(');
expect(darkModeCss).toContain('background-color: color-mix(');
expect(darkModeCss).toContain('background-color: var(--storefront-dark-card);');
expect(darkModeCss).toContain('color: var(--storefront-dark-foreground);');
```

- [ ] **Step 3: Run the failing tests**

```bash
pnpm --dir apps/web exec vitest run \
  src/components/storefront/ogabassey/pages/checkout-page.test.tsx \
  'src/app/(storefront)/storefront-css-partition.test.ts'
```

Expected:

```text
FAIL apps/web/src/components/storefront/ogabassey/pages/checkout-page.test.tsx
FAIL src/app/(storefront)/storefront-css-partition.test.ts
```

- [ ] **Step 4: Add the checkout scope class**

In `apps/web/src/components/storefront/ogabassey/pages/checkout-page.tsx`, add `ogabassey-checkout-page` to the root element for all checkout states:

```tsx
<div className="ogabassey-checkout-page min-h-screen bg-gray-50/50 flex items-center justify-center pb-20">
```

Apply that class to the loading/auto-trigger root, the resume-error root, and the normal checkout root. Do not change checkout state logic, payment logic, form validation, cart behavior, or route navigation in this task.

- [ ] **Step 5: Add scoped dark utility overrides**

In `apps/web/src/app/(storefront)/storefront-ogabassey-dark-mode.css`, keep broad utility overrides scoped to `.ogabassey-storefront-shell` and checkout-specific overrides scoped to `.ogabassey-checkout-page`. Put these in `@layer utilities`, not unscoped global CSS:

```css
.storefront-variant-ogabassey.storefront-mode-dark
  .ogabassey-storefront-shell
  :is(.bg-white, .bg-gray-50, .bg-gray-100) {
  background-color: var(--storefront-dark-card);
}

.storefront-variant-ogabassey.storefront-mode-dark .ogabassey-checkout-page {
  background-color: var(--storefront-dark-background);
  color: var(--storefront-dark-foreground);
}

.storefront-variant-ogabassey.storefront-mode-dark
  .ogabassey-checkout-page
  :is(.bg-white, .bg-gray-50, .bg-gray-100, .bg-red-100, .bg-green-50) {
  background-color: var(--storefront-dark-card);
}

@media (prefers-color-scheme: dark) {
  .storefront-variant-ogabassey.storefront-mode-system
    .ogabassey-storefront-shell
    :is(.bg-white, .bg-gray-50, .bg-gray-100) {
    background-color: var(--storefront-dark-card);
  }

  .storefront-variant-ogabassey.storefront-mode-system
    .ogabassey-checkout-page {
    background-color: var(--storefront-dark-background);
    color: var(--storefront-dark-foreground);
  }
}
```

Do not add broad selectors such as `.storefront-variant-ogabassey .bg-white` without the `.ogabassey-storefront-shell` or `.ogabassey-checkout-page` boundary.

- [ ] **Step 6: Use lint-safe browser fallbacks**

Keep `color-mix()` behind `@supports (background-color: color-mix(...))` and use `background-color` consistently. Do not use duplicate `background` fallback declarations, because Biome rejects them.

- [ ] **Step 7: Run the focused tests**

```bash
pnpm --dir apps/web exec vitest run \
  src/components/storefront/ogabassey/pages/checkout-page.test.tsx \
  'src/app/(storefront)/storefront-css-partition.test.ts'
```

Expected:

```text
PASS apps/web/src/components/storefront/ogabassey/pages/checkout-page.test.tsx
PASS src/app/(storefront)/storefront-css-partition.test.ts
```

---

### Task 6: Keep Root Dark Styling Out of Storefront Scope

**Files:**
- Modify: `apps/web/tailwind.config.mjs`
- Modify: `apps/web/src/app/globals.css`
- Modify: `apps/web/src/app/(storefront)/storefront-globals.css`
- Modify: `apps/web/src/components/storefront/storefront-theme-provider.test.tsx`

- [ ] **Step 1: Add source assertions to the provider test**

Add this import to `storefront-theme-provider.test.tsx`:

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
```

Add this helper and these tests:

```ts
function readProjectFile(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), 'utf8');
}

it('keeps Tailwind dark utilities excluded inside storefront theme scopes', () => {
  const tailwindConfig = readProjectFile('tailwind.config.mjs');

  expect(tailwindConfig).toContain(':not(.storefront-theme-scope)');
  expect(tailwindConfig).toContain(':not(.storefront-theme-scope *)');
});

it('keeps authored global dark selectors excluded inside storefront theme scopes', () => {
  const staleDirectGuard =
    /:not\(\.light\):not\(\.storefront-light\)(?!:not\(\.storefront-theme-scope\))/;
  const staleDescendantGuard =
    /:not\(\.light \*\):not\(\.storefront-light \*\)(?!:not\(\.storefront-theme-scope \*\))/;
  const guardedCssFiles = [
    'src/app/globals.css',
    'src/app/(storefront)/storefront-globals.css',
  ] as const;

  for (const filePath of guardedCssFiles) {
    const css = readProjectFile(filePath);

    expect(css, filePath).not.toMatch(staleDirectGuard);
    expect(css, filePath).not.toMatch(staleDescendantGuard);
    expect(css, filePath).toContain(':not(.storefront-theme-scope *)');
  }
});
```

- [ ] **Step 2: Run the failing test**

```bash
pnpm --dir apps/web exec vitest run src/components/storefront/storefront-theme-provider.test.tsx
```

Expected:

```text
FAIL src/components/storefront/storefront-theme-provider.test.tsx
```

- [ ] **Step 3: Update Tailwind darkMode selector**

In `apps/web/tailwind.config.mjs`, update the `darkMode` selector to exclude the generic storefront theme scope:

```js
darkMode: [
  'variant',
  '&:where(.dark, .dark *):not(.light):not(.light *):not(.storefront-light):not(.storefront-light *):not(.storefront-theme-scope):not(.storefront-theme-scope *)',
],
```

- [ ] **Step 4: Update authored global dark guards**

In `apps/web/src/app/globals.css` and `apps/web/src/app/(storefront)/storefront-globals.css`, replace every descendant guard:

```css
:not(.light *):not(.storefront-light *)
```

with:

```css
:not(.light *):not(.storefront-light *):not(.storefront-theme-scope *)
```

If either file has a direct element guard, replace:

```css
:not(.light):not(.storefront-light)
```

with:

```css
:not(.light):not(.storefront-light):not(.storefront-theme-scope)
```

Do not change the `.light` or `.storefront-light` variable definitions themselves; this task only extends selectors that opt root dark styling out of storefront subtrees.

- [ ] **Step 5: Run the provider test**

```bash
pnpm --dir apps/web exec vitest run src/components/storefront/storefront-theme-provider.test.tsx
```

Expected:

```text
PASS src/components/storefront/storefront-theme-provider.test.tsx
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/tailwind.config.mjs \
  apps/web/src/app/globals.css \
  'apps/web/src/app/(storefront)/storefront-globals.css' \
  apps/web/src/components/storefront/storefront-theme-provider.test.tsx
git commit -m "fix: isolate storefront dark utilities from root theme"
```

---

### Task 7: SEO and Browser Verification

**Files:** no source modification expected.

- [ ] **Step 1: Run focused unit tests**

```bash
pnpm --dir apps/web exec vitest run \
  src/components/storefront/storefront-appearance.test.ts \
  src/components/storefront/storefront-theme-provider.test.tsx \
  src/components/storefront/ogabassey/dark-mode-tokens.test.ts \
  src/components/storefront/ogabassey/pages/checkout-page.test.tsx \
  'src/app/(storefront)/[slug]/layout.test.tsx' \
  'src/app/(storefront)/storefront-css-partition.test.ts'
```

Expected:

```text
All listed test files pass.
```

- [ ] **Step 2: Run the repo-required web gates**

```bash
pnpm turbo lint && pnpm turbo typecheck
```

Expected:

```text
Both commands exit 0.
```

- [ ] **Step 3: Start local web server**

Use the repo's normal dev path unless the implementer is validating a production build:

```bash
pnpm --filter @baci/web dev
```

Expected:

```text
The web app is available on a local port, usually http://localhost:3000.
```

- [ ] **Step 4: Compare semantic HTML for SEO**

Run against a local Ogabassey page and the matching live page. Replace the local URL if the dev server uses a different port:

```bash
curl -sS 'https://ogabassey.com/' > /tmp/ogabassey-live.html
curl -sS 'http://localhost:3000/ogabassey' > /tmp/ogabassey-local.html

python3 - <<'PY'
from pathlib import Path
import re

def capture(name: str):
    html = Path(f'/tmp/ogabassey-{name}.html').read_text(errors='ignore')
    fields = {
        'title': re.search(r'<title>(.*?)</title>', html, re.I | re.S),
        'canonical': re.search(
            r'<link[^>]+rel=["\']canonical["\'][^>]+href=["\']([^"\']+)',
            html,
            re.I,
        ),
        'og:title': re.search(
            r'<meta[^>]+property=["\']og:title["\'][^>]+content=["\']([^"\']+)',
            html,
            re.I,
        ),
        'twitter:card': re.search(
            r'<meta[^>]+name=["\']twitter:card["\'][^>]+content=["\']([^"\']+)',
            html,
            re.I,
        ),
        'h1_count': len(re.findall(r'<h1\b', html, re.I)),
        'json_ld_count': len(re.findall(r'application/ld\+json', html, re.I)),
    }
    return {
        key: (value.group(1).strip() if hasattr(value, 'group') else value)
        for key, value in fields.items()
    }

live = capture('live')
local = capture('local')

for name, snapshot in [('live', live), ('local', local)]:
    print(name)
    for key, value in snapshot.items():
        print(f'  {key}: {value}')

missing = [key for key, value in local.items() if not value]
if missing:
    raise SystemExit(f'local SEO snapshot is missing: {", ".join(missing)}')
PY
```

Expected:

```text
The local page still contains title, canonical, JSON-LD, social metadata, and h1 markers. Local/live values should match where the data source is the same; any difference must be explained by local fixture/runtime data, not theme logic.
```

- [ ] **Step 5: Verify browser theme behavior manually**

Use Chrome DevTools Rendering panel or Playwright/Chrome emulation to check:

```text
Route: /
Route: /smartphones
Route: one live PDP equivalent
Route: /ogabassey/checkout locally, or /checkout on the live custom domain
Viewport: 390x844
Viewport: 1440x900
Color scheme: light
Color scheme: dark
```

Expected:

```text
Light mode matches the current storefront.
Dark mode changes colors only. Text remains readable, product images are unchanged, layout does not shift, search input and checkout form carets are themed, and no custom mouse cursor appears.
```

- [ ] **Step 6: Run performance checks**

Run the existing Ogabassey CSS budget or Lighthouse/PageSpeed workflow used for the current branch. At minimum:

```bash
pnpm --dir apps/web exec vitest run 'src/app/(storefront)/storefront-css-partition.test.ts'
```

Expected:

```text
No new broad CSS import leaks into PDP-only or below-fold chunks. If Lighthouse/PageSpeed is run, LCP, FCP, and CLS must not show a material regression.
```

- [ ] **Step 7: Run CodeRabbit before handoff**

```bash
coderabbit review --prompt-only -t uncommitted
```

Expected:

```text
No critical or high findings remain unresolved.
```

---

### Task 8: Rollout and Production Checks

**Files:** no source modification expected.

- [ ] **Step 1: Open a PR with the verification summary**

The PR description must include:

```text
- OgaBassey only; other storefronts remain forced light.
- Dark mode is CSS/token-only.
- SEO semantic output was checked: title, canonical, h1, JSON-LD, social metadata.
- Browser support fallback: unsupported prefers-color-scheme/color-scheme/caret-color stays light/default.
- Search and checkout text insertion carets were checked in dark/system-dark mode.
- Product images are not filtered or swapped.
- LCP/FCP/CLS checks show no material regression, or list the measured deltas.
```

- [ ] **Step 2: After merge/deploy, verify live light and dark rendering**

Use DevTools color-scheme emulation or automated screenshots against:

```text
https://ogabassey.com/
https://ogabassey.com/smartphones
https://ogabassey.com/<representative-category>/<representative-product-slug>
https://ogabassey.com/checkout
```

Expected:

```text
Live dark mode renders with dark surfaces and amber accents. Live light mode remains unchanged.
```

- [ ] **Step 3: After merge/deploy, verify live SEO markers**

```bash
curl -sS 'https://ogabassey.com/' | rg -n '<title>|rel="canonical"|application/ld\\+json|og:title|twitter:card|<h1'
```

Expected:

```text
SEO markers remain present. Theme classes and CSS are the only intended differences.
```

- [ ] **Step 4: Do not run a cloud-building production deploy from Codex**

Production deploys must follow the repo rule:

```text
Use the local/prebuilt CI build path and finish with vercel deploy --prebuilt --prod. Do not run cloud-building deploy commands from Codex.
```

---

## Acceptance Criteria

- `ogabassey.com` respects system dark mode.
- Non-Ogabassey storefronts remain forced light.
- Search, forms, and checkout-facing storefront controls get themed `caret-color`; no custom mouse pointer is introduced.
- Unsupported browsers fall back to current light/default behavior.
- No product images are filtered or swapped for dark mode.
- HTML semantics and SEO metadata remain unchanged by appearance mode.
- Token contrast tests pass.
- Focused unit/CSS tests pass.
- `pnpm turbo lint && pnpm turbo typecheck` pass before PR handoff.
- CodeRabbit has no unresolved critical/high findings.
