'use client';

import { type ReactNode, useEffect, useRef } from 'react';
import {
  DEFAULT_STOREFRONT_APPEARANCE,
  getStorefrontAppearanceClassName,
  getStorefrontDocumentAppearanceClasses,
  type StorefrontAppearance,
} from './storefront-appearance';

const DOCUMENT_CLASS_COUNT_ATTRS: Record<string, string> = {
  light: 'data-storefront-light-mode-count',
  'storefront-light': 'data-storefront-light-count',
};

function getDocumentClassCountAttr(className: string): string {
  return DOCUMENT_CLASS_COUNT_ATTRS[className] ?? `data-${className}-count`;
}

function getDocumentClassPreexistingAttr(className: string): string {
  return `${getDocumentClassCountAttr(className)}-preexisting`;
}

function incrementDocumentClass(target: HTMLElement, className: string) {
  const countAttr = getDocumentClassCountAttr(className);
  const preexistingAttr = getDocumentClassPreexistingAttr(className);
  const hasStorefrontCount = target.hasAttribute(countAttr);
  if (!hasStorefrontCount && target.classList.contains(className)) {
    target.setAttribute(preexistingAttr, 'true');
  }

  const current = Number.parseInt(target.getAttribute(countAttr) ?? '0', 10);
  const next = Number.isFinite(current) ? current + 1 : 1;
  target.setAttribute(countAttr, String(next));
  target.classList.add(className);
}

function decrementDocumentClass(target: HTMLElement, className: string) {
  const countAttr = getDocumentClassCountAttr(className);
  const preexistingAttr = getDocumentClassPreexistingAttr(className);
  const current = Number.parseInt(target.getAttribute(countAttr) ?? '0', 10);
  const next = Number.isFinite(current) ? current - 1 : 0;

  if (next > 0) {
    target.setAttribute(countAttr, String(next));
    return;
  }

  const preservePreexistingClass =
    target.getAttribute(preexistingAttr) === 'true';
  target.removeAttribute(countAttr);
  target.removeAttribute(preexistingAttr);
  if (!preservePreexistingClass) {
    target.classList.remove(className);
  }
}

function incrementDocumentClasses(target: HTMLElement, classNames: string[]) {
  for (const className of classNames) {
    incrementDocumentClass(target, className);
  }
}

function decrementDocumentClasses(target: HTMLElement, classNames: string[]) {
  for (const className of classNames) {
    decrementDocumentClass(target, className);
  }
}

/**
 * Scopes storefront theming away from the Baci app shell. Default storefronts
 * stay forced light, while tenant-approved variants can opt into system-aware
 * appearance with their own CSS token layer.
 *
 * Why a wrapper div instead of a nested next-themes ThemeProvider?
 * next-themes@0.4.x treats nested ThemeProvider instances as pass-through when
 * a context already exists (the root Providers component mounts one), so
 * `forcedTheme` on a nested provider is a no-op.
 *
 * Instead we apply stable CSS classes directly to a wrapper element. The
 * wrapper uses `contents` so it does not introduce an extra layout box.
 */
export function StorefrontThemeProvider({
  appearance = DEFAULT_STOREFRONT_APPEARANCE,
  children,
  scopeDocument = true,
}: {
  appearance?: StorefrontAppearance;
  children: ReactNode;
  scopeDocument?: boolean;
}) {
  const { mode, variant } = appearance;
  const normalizedAppearance: StorefrontAppearance = { mode, variant };
  const wrapperClassName =
    getStorefrontAppearanceClassName(normalizedAppearance);
  const hasAppliedDocumentClassesRef = useRef(false);

  useEffect(() => {
    if (!scopeDocument) {
      return;
    }

    let applied = false;
    let timeoutId: number | undefined;
    const root = document.documentElement;
    const body = document.body;
    const documentClasses = getStorefrontDocumentAppearanceClasses({
      mode,
      variant,
    });
    const applyDocumentClasses = () => {
      incrementDocumentClasses(root, documentClasses);
      incrementDocumentClasses(body, documentClasses);
      applied = true;
      hasAppliedDocumentClassesRef.current = true;
    };

    // Defer document-level mutations until after React's hydration turn; mutating
    // html/body from a layout effect can invalidate streamed PPR boundaries.
    if (hasAppliedDocumentClassesRef.current) {
      applyDocumentClasses();
    } else {
      timeoutId = window.setTimeout(applyDocumentClasses, 0);
    }

    return () => {
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
      if (!applied) {
        return;
      }

      decrementDocumentClasses(root, documentClasses);
      decrementDocumentClasses(body, documentClasses);
    };
  }, [mode, scopeDocument, variant]);

  return <div className={wrapperClassName}>{children}</div>;
}
