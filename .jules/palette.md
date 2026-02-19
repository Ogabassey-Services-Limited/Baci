## 2024-05-23 - Accessibility Anti-Pattern: tabIndex={-1}

**Learning:** Developers previously added `tabIndex={-1}` to interactive elements (specifically the password toggle) with the comment "Skip tab index to keep flow natural". This indicates a misunderstanding that "natural flow" means skipping secondary actions, whereas true accessibility requires all interactive elements to be reachable.
**Action:** When auditing components, specifically check for `tabIndex={-1}` on buttons inside inputs or complex widgets. Remove it to restore keyboard accessibility and rely on logical DOM order instead.

## 2024-05-24 - Product Pricing Context

**Learning:** `StorefrontProductCard` previously lacked pricing context (original price, percentage off) compared to `QuickViewModal`, making it harder for users to identify deals and causing accessibility gaps for screen readers who only heard the current price.
**Action:** When displaying discounted prices, always include the original price (crossed out) and a specific percentage badge. Use `sr-only` text to explicitly label "Original price" and "Current price" to prevent confusion for screen reader users and ensure strict WCAG 2.1 AA compliance.

## 2026-02-12 - Reduced Motion Implementation

**Learning:** `framer-motion` hooks like `useReducedMotion` may return complex objects (MotionValue) instead of simple booleans depending on the version, which can lead to always-true conditionals if not handled correctly.
**Action:** Prefer native `window.matchMedia` hooks for simple boolean checks to avoid dependency quirks and ensure reliable accessibility compliance.

## 2026-02-18 - Focus Management in Deletable Lists

**Learning:** Removing items from a list (like `TagInput`) causes focus loss to the `body` if not managed, forcing keyboard users to re-navigate the entire page.
**Action:** Use a `useEffect` and `useRef` to track the removed index and programmatically restore focus to the nearest remaining item or the input field.
