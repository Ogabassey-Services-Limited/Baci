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
 * The `.light` rule in globals.css re-declares all CSS variables to their
 * light-mode values, scoping them to this subtree and overriding any `html.dark`
 * class set by the root ThemeProvider.
 */
export function StorefrontThemeProvider({ children }: { children: ReactNode }) {
  return <div className="light">{children}</div>;
}
