import type { ReactNode } from 'react';

/**
 * Forces the storefront subtree to render in light mode regardless of the
 * user's OS / browser theme preference.
 *
 * Why a plain div instead of a nested next-themes ThemeProvider?
 * next-themes@0.4.x treats nested ThemeProvider instances as pass-through when
 * a context already exists (the root Providers component mounts one), so
 * `forcedTheme="light"` on a nested provider is a no-op.
 *
 * Instead we apply the `.light` CSS class directly to a wrapper element.
 * Two layered mechanisms cooperate to force light mode:
 *
 * 1. The `.light` rule in globals.css re-declares all CSS custom properties to
 *    their light-mode values, so `bg-[var(--background)]` and friends resolve
 *    to light tokens inside this subtree.
 * 2. The `darkMode` selector in tailwind.config.ts excludes `.light` and its
 *    descendants from the `dark:` variant, so raw utilities like
 *    `dark:bg-gray-900` also stop firing inside this wrapper. Without this
 *    paired config change, Tailwind `dark:*` variants would still apply
 *    (since `.dark` on `<html>` still matches descendant `dark:*` rules).
 */
export function StorefrontThemeProvider({ children }: { children: ReactNode }) {
  return <div className="light">{children}</div>;
}
