'use client';

import { type ReactNode, useLayoutEffect } from 'react';

const STOREFRONT_LIGHT_CLASS = 'storefront-light';
const STOREFRONT_LIGHT_ATTR = 'data-storefront-light-count';

function incrementStorefrontLightScope(target: HTMLElement) {
  const current = Number.parseInt(
    target.getAttribute(STOREFRONT_LIGHT_ATTR) ?? '0',
    10
  );
  const next = Number.isFinite(current) ? current + 1 : 1;
  target.setAttribute(STOREFRONT_LIGHT_ATTR, String(next));
  target.classList.add(STOREFRONT_LIGHT_CLASS);
}

function decrementStorefrontLightScope(target: HTMLElement) {
  const current = Number.parseInt(
    target.getAttribute(STOREFRONT_LIGHT_ATTR) ?? '0',
    10
  );
  const next = Number.isFinite(current) ? current - 1 : 0;
  if (next > 0) {
    target.setAttribute(STOREFRONT_LIGHT_ATTR, String(next));
    return;
  }

  target.removeAttribute(STOREFRONT_LIGHT_ATTR);
  target.classList.remove(STOREFRONT_LIGHT_CLASS);
}

/**
 * Forces the storefront subtree to render in light mode regardless of the
 * user's OS / browser theme preference.
 *
 * Why a wrapper div instead of a nested next-themes ThemeProvider?
 * next-themes@0.4.x treats nested ThemeProvider instances as pass-through when
 * a context already exists (the root Providers component mounts one), so
 * `forcedTheme="light"` on a nested provider is a no-op.
 *
 * Instead we apply the `.light` CSS class directly to a wrapper element.
 * The wrapper uses `contents` so it does not introduce an extra layout box.
 * Two layered mechanisms cooperate to force light mode:
 *
 * 1. The `.light` rule in globals.css re-declares all CSS custom properties to
 *    their light-mode values, so `bg-(--background)` and friends resolve
 *    to light tokens inside this subtree.
 * 2. The `darkMode` selector in tailwind.config.ts excludes `.light` and its
 *    descendants from the `dark:` variant, so raw utilities like
 *    `dark:bg-gray-900` also stop firing inside this wrapper. Without this
 *    paired config change, Tailwind `dark:*` variants would still apply
 *    (since `.dark` on `<html>` still matches descendant `dark:*` rules).
 */
export function StorefrontThemeProvider({ children }: { children: ReactNode }) {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const body = document.body;

    incrementStorefrontLightScope(root);
    incrementStorefrontLightScope(body);

    return () => {
      decrementStorefrontLightScope(root);
      decrementStorefrontLightScope(body);
    };
  }, []);

  return <div className="light contents">{children}</div>;
}
